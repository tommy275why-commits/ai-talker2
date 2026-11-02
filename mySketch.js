/*
===============================================================================
PROJECT GENESIS V6: DYNAMIC WEB VOCABULARY & RECURRENT LANGUAGE ENGINE
Self-evolving text AI with live web vocabulary extraction, recurrent word 
context memory, user prompting, and a copy-pasteable terminal.

Upgrades in V6:
- Dynamic Web Vocabulary: Dictionaries auto-expand from Wikipedia & News feeds.
- Recurrent Context Window: Feeds last 3 generated tokens back into inputs.
- Interactive User Steering: User input box sends text signals directly into the brain.
===============================================================================
*/

let genesis;
let languageEvaluator;
let copyBox;
let userPromptBox;

let running = true;
let totalSteps = 0;
let episodeSteps = 0;
let episodeScore = 0;
let trainingExampleCount = 0;

let lastDecision = null;
let lastActionName = "Waiting";
let lastReward = 0;

let bestFitness = -Infinity;
let bestBrainData = null;

let statusMessage = "Initializing Genesis V6";
let statusTimer = 0;
let generatedTextLog = "";

const STORAGE_KEY = "GENESIS_BRAIN_V6";
const WORLD_MEMORY_KEY = "GENESIS_WORLD_MEMORY_V6";
const MAX_WORLD_MEMORY = 400;

const GENESIS_LOCATION = {
  latitude: 41.70,
  longitude: -93.05
};

const WORLD = {
  x: 300,
  y: 82,
  w: 660,
  h: 480
};

// Dynamic Vocabulary List (Starts base, expands from web scans)
let VOCABULARY = [
  "system", "world", "signal", "pulse", "memory",
  "network", "orbit", "earth", "time", "data", "growth", "light"
];

// Recurrent Context Window (Stores indices of last 3 tokens)
let tokenHistory = [0, 0, 0];
let userPromptSignal = 0;

const BASE_INPUT_COUNT = 11; // 8 state/vision + 3 token history
const WEB_SENSOR_COUNT = 6;
const INPUT_COUNT = BASE_INPUT_COUNT + WEB_SENSOR_COUNT; // 17 Total Inputs
let OUTPUT_COUNT = VOCABULARY.length + 4; // Vocab size + Punctuation + 3 Meta Controls

let worldMemory = [];
let worldSourceStatus = {};
let worldScanIndex = 0;
let worldScanBusy = false;
let worldProviderLastFetch = {};

let webSensors = [
  { name: "Temperature", val: 0 },
  { name: "Humidity", val: 0 },
  { name: "Wind", val: 0 },
  { name: "Air Quality", val: 0 },
  { name: "Earthquakes", val: 0 },
  { name: "World Activity", val: 0 }
];

const WORLD_CATALOG = [];

const WORLD_PROVIDER_COOLDOWN = {
  weather: 5 * 60 * 1000,
  air: 10 * 60 * 1000,
  earthquake: 5 * 60 * 1000,
  apod: 60 * 60 * 1000,
  donki: 45 * 60 * 1000,
  worldbank: 24 * 60 * 60 * 1000,
  countries: 24 * 60 * 60 * 1000,
  wikipedia: 10 * 60 * 1000,
  github: 10 * 60 * 1000,
  hackernews: 5 * 60 * 1000,
  openlibrary: 60 * 60 * 1000,
  metmuseum: 60 * 60 * 1000
};

const WORLD_PROVIDER_ORDER = [
  "weather", "air", "earthquake", "apod", "donki", "worldbank",
  "countries", "wikipedia", "github", "hackernews", "openlibrary", "metmuseum"
];

// =============================================================================
// SETUP & INTERFACE
// =============================================================================

function setup() {
  createCanvas(1000, 700);
  pixelDensity(1);

  // 1. Terminal Output Box
  copyBox = createElement('textarea');
  copyBox.position(WORLD.x + 10, WORLD.y + 10);
  copyBox.size(WORLD.w - 20, WORLD.h - 20);
  copyBox.style('background-color', '#12141D');
  copyBox.style('color', '#41D287');
  copyBox.style('font-family', 'monospace');
  copyBox.style('font-size', '13px');
  copyBox.style('line-height', '1.5');
  copyBox.style('padding', '12px');
  copyBox.style('border', '1px solid #465264');
  copyBox.style('border-radius', '6px');
  copyBox.style('resize', 'none');
  copyBox.style('outline', 'none');
  copyBox.value("// GENESIS TERMINAL V6 (DYNAMIC VOCABULARY ENGINE)...\n\n");

  // 2. Interactive User Input Prompt Box
  userPromptBox = createInput('');
  userPromptBox.position(WORLD.x + 10, WORLD.y + WORLD.h + 10);
  userPromptBox.size(WORLD.w - 110, 28);
  userPromptBox.attribute('placeholder', 'Type words here to steer Genesis thought patterns...');
  userPromptBox.style('background-color', '#1B202B');
  userPromptBox.style('color', '#E1E1E1');
  userPromptBox.style('border', '1px solid #465264');
  userPromptBox.style('border-radius', '4px');
  userPromptBox.style('padding', '0 8px');

  let sendBtn = createButton('SEND');
  sendBtn.position(WORLD.x + WORLD.w - 90, WORLD.y + WORLD.h + 10);
  sendBtn.size(80, 30);
  sendBtn.style('background-color', '#273040');
  sendBtn.style('color', '#FFFFFF');
  sendBtn.style('border', 'none');
  sendBtn.style('border-radius', '4px');
  sendBtn.style('cursor', 'pointer');
  sendBtn.mousePressed(handleUserPrompt);

  OUTPUT_COUNT = VOCABULARY.length + 4;
  genesis = new DynamicBrain(INPUT_COUNT, OUTPUT_COUNT, 7);
  languageEvaluator = new WebLanguageEvaluator();

  loadLocalBrain();
  loadWorldMemory();

  let fileInput = createFileInput(handleBrainFile);
  fileInput.position(20, 665);

  setStatus("Genesis V6 (Dynamic Vocabulary Engine) Ready");
  scanNextProvider();
}

function handleUserPrompt() {
  let val = userPromptBox.value().trim();
  if (!val) return;

  let words = val.toLowerCase().split(/\s+/);
  for (let w of words) {
    w = w.replace(/[^a-z]/g, '');
    if (w.length > 2) addWordToVocabulary(w);
  }

  userPromptSignal = 1.0;
  userPromptBox.value('');
  setStatus("Prompt injected into Genesis inputs");
}

function addWordToVocabulary(word) {
  if (!VOCABULARY.includes(word)) {
    VOCABULARY.push(word);
    OUTPUT_COUNT = VOCABULARY.length + 4;

    // Dynamically expand output nodes in neural network
    if (genesis) genesis.addOutputNode();
  }
}

function draw() {
  background(13, 16, 23);

  drawHeader();
  drawWorldPanel();
  drawBrainPanel();
  drawStatsPanel();
  drawControls();

  if (running && frameCount % 8 === 0) {
    performStep();
  }

  if (frameCount % 900 === 0) {
    scanNextProvider();
  }

  if (statusTimer > 0) {
    statusTimer--;
  }

  userPromptSignal *= 0.95; // Decay user steering signal over time
}

function drawHeader() {
  fill(235);
  noStroke();
  textAlign(LEFT, CENTER);
  textSize(23);
  textStyle(BOLD);
  text("PROJECT GENESIS V6", 20, 27);

  textStyle(NORMAL);
  textSize(11);
  fill(135, 155, 175);
  text("RECURRENT VOCABULARY & DISCOURSE ENGINE", 22, 49);

  fill(running ? color(65, 210, 135) : color(230, 175, 75));
  circle(972, 27, 9);

  fill(205);
  textAlign(RIGHT, CENTER);
  textSize(12);
  text(running ? "TALKING" : "PAUSED", 958, 27);
}

function drawWorldPanel() {
  noStroke();
  fill(27, 32, 43);
  rect(WORLD.x - 1, WORLD.y - 1, WORLD.w + 2, WORLD.h + 2, 8);

  fill(180);
  textAlign(LEFT, CENTER);
  textSize(11);
  text("GENESIS RECURRENT DISCOURSE BUFFER", WORLD.x, 70);
}

function drawBrainPanel() {
  let x = 20;
  let y = 88;
  let w = 260;
  let h = 300;

  noStroke();
  fill(25, 30, 41);
  rect(x, y, w, h, 8);

  fill(230);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(13);
  text("NEURAL STRUCTURE", x + 14, y + 19);

  textStyle(NORMAL);
  genesis.drawNetwork(x + 12, y + 42, w - 24, h - 58);

  fill(135, 150, 170);
  textSize(10);
  text("Green: sensors | White: hidden | Orange: vocabulary", x + 13, y + h - 10);
}

function drawStatsPanel() {
  let x = 20;
  let y = 402;
  let w = 260;
  let h = 210;

  noStroke();
  fill(25, 30, 41);
  rect(x, y, w, h, 8);

  fill(230);
  textStyle(BOLD);
  textSize(13);
  textAlign(LEFT, CENTER);
  text("SYSTEM STATUS", x + 14, y + 20);

  textStyle(NORMAL);

  let onlineSources = Object.values(worldSourceStatus).filter(s => s === "Online").length;

  let rows = [
    ["Neurons", genesis.nodes.length],
    ["Connections", genesis.connections.filter(c => c.enabled).length],
    ["Vocabulary Size", VOCABULARY.length],
    ["Words Spoken", totalSteps],
    ["Training Examples", trainingExampleCount],
    ["World Records", worldMemory.length],
    ["Sources Online", onlineSources + "/" + WORLD_PROVIDER_ORDER.length],
    ["Last Word", lastActionName],
    ["Last Reward", nf(lastReward, 1, 3)],
    ["Episode Score", nf(episodeScore, 1, 2)],
    ["Best Fitness", bestFitness === -Infinity ? "—" : nf(bestFitness, 1, 2)]
  ];

  textSize(10);
  for (let i = 0; i < rows.length; i++) {
    let yy = y + 45 + i * 15.5;
    fill(135, 150, 170);
    textAlign(LEFT, CENTER);
    text(rows[i][0], x + 14, yy);

    fill(225);
    textAlign(RIGHT, CENTER);
    text(String(rows[i][1]), x + w - 14, yy);
  }
}

function drawControls() {
  let x = 300;
  let y = 635;
  let w = 76;
  let gap = 6;

  let labels = [
    running ? "PAUSE" : "RUN",
    "STEP",
    "REWARD",
    "PENALIZE",
    "SAVE",
    "EXPORT",
    "CLEAR",
    "SCAN"
  ];

  for (let i = 0; i < labels.length; i++) {
    drawButton(x + i * (w + gap), y, w, 34, labels[i]);
  }

  if (statusTimer > 0) {
    fill(120, 205, 160);
    textAlign(RIGHT, CENTER);
    textSize(10);
    text(statusMessage, 960, 620);
  }
}

function drawButton(x, y, w, h, label) {
  let hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  noStroke();
  fill(hovered ? color(65, 85, 110) : color(39, 48, 64));
  rect(x, y, w, h, 6);

  fill(220);
  textAlign(CENTER, CENTER);
  textSize(10);
  textStyle(BOLD);
  text(label, x + w / 2, y + h / 2);
  textStyle(NORMAL);
}

function mousePressed() {
  let x = 300;
  let y = 635;
  let w = 76;
  let gap = 6;

  if (mouseY < y || mouseY > y + 34) return;

  let buttonIndex = floor((mouseX - x) / (w + gap));
  if (buttonIndex < 0 || buttonIndex > 7) return;

  let localX = mouseX - (x + buttonIndex * (w + gap));
  if (localX > w) return;

  if (buttonIndex === 0) running = !running;
  else if (buttonIndex === 1) performStep();
  else if (buttonIndex === 2) giveFeedback(1.0);
  else if (buttonIndex === 3) giveFeedback(-1.0);
  else if (buttonIndex === 4) {
    saveLocalBrain();
    saveWorldMemory();
    setStatus("Genesis & Memory saved");
  } else if (buttonIndex === 5) exportBrain();
  else if (buttonIndex === 6) {
    copyBox.value("// TERMINAL CLEARED\n\n");
    generatedTextLog = "";
    setStatus("Text log cleared");
  } else if (buttonIndex === 7) scanNextProvider();
}

// =============================================================================
// LANGUAGE DECISION & EXECUTION ENGINE
// =============================================================================

function performStep() {
  let inputs = collectInputs();

  while (genesis.inputNodes.length < inputs.length) {
    genesis.addInputNode();
  }

  let outputs = genesis.feedForward(inputs);

  // Softmax sampling across dynamic vocabulary
  let probabilities = softmax(outputs.slice(0, VOCABULARY.length));
  let wordIndex = sampleChoice(probabilities);
  let word = VOCABULARY[wordIndex];

  // Punctuation and meta triggers
  let punctuationVal = outputs[VOCABULARY.length];
  let growthTrigger = outputs[VOCABULARY.length + 1];
  let wireTrigger = outputs[VOCABULARY.length + 2];

  let punctuation = " ";
  if (punctuationVal > 0.6) punctuation = ". ";
  else if (punctuationVal > 0.2) punctuation = ", ";
  else if (punctuationVal < -0.5) punctuation = "\n";

  if (generatedTextLog.endsWith(". ") || generatedTextLog.endsWith("\n") || generatedTextLog.length === 0) {
    word = word.charAt(0).toUpperCase() + word.slice(1);
  }

  let tokenOutput = word + punctuation;
  generatedTextLog += tokenOutput;

  // Append token to text terminal
  copyBox.value(copyBox.value() + tokenOutput);
  copyBox.elt.scrollTop = copyBox.elt.scrollHeight;

  // Update Recurrent Word Memory History
  tokenHistory.shift();
  tokenHistory.push(wordIndex);

  // Meta Growth
  if (growthTrigger > 0.75) {
    genesis.addNode();
    setStatus("AI structural growth (New Hidden Neuron)");
  }

  if (wireTrigger > 0.75) {
    genesis.addConnection();
    setStatus("AI structural growth (New Pathway Wire)");
  }

  let reward = calculateLanguageReward(wordIndex, punctuationVal);

  let decision = {
    action: wordIndex,
    probabilities: probabilities
  };

  genesis.learn(decision, reward);

  lastDecision = decision;
  lastActionName = word;
  lastReward = reward;

  totalSteps++;
  episodeSteps++;
  episodeScore += reward;

  if (episodeSteps >= 120) {
    finishGeneration();
  }

  if (totalSteps % 30 === 0) {
    saveLocalBrain();
  }
}

function calculateLanguageReward(wordIndex, punctuationVal) {
  let newWord = genesis.actionCounts[wordIndex] === 0;
  if (!genesis.actionCounts[wordIndex]) genesis.actionCounts[wordIndex] = 0;
  genesis.actionCounts[wordIndex]++;

  let noveltyScore = newWord ? 0.5 : 0.05;
  let penalty = genesis.actionCounts[wordIndex] > 15 ? -0.15 : 0;
  let evaluatorScore = languageEvaluator
    ? languageEvaluator.evaluateStep(VOCABULARY[wordIndex], lastActionName)
    : 0;

  return constrain(noveltyScore + penalty + evaluatorScore, -1.0, 1.0);
}

function collectInputs() {
  let progress = (episodeSteps % 120) / 120;
  let diversity = new Set(genesis.actionCounts.map((v, i) => (v > 0 ? i : -1))).size / VOCABULARY.length;
  let lastWordNorm = lastDecision ? (lastDecision.action / VOCABULARY.length) * 2 - 1 : 0;

  let h0 = (tokenHistory[0] / VOCABULARY.length) * 2 - 1;
  let h1 = (tokenHistory[1] / VOCABULARY.length) * 2 - 1;
  let h2 = (tokenHistory[2] / VOCABULARY.length) * 2 - 1;

  let sensoryArray = [
    sin(totalSteps * 0.1),
    cos(totalSteps * 0.1),
    lastWordNorm,
    h0, h1, h2,             // Recurrent word history inputs
    userPromptSignal,       // User steering signal input
    progress * 2 - 1,
    diversity * 2 - 1,
    constrain(episodeScore / 10, -1, 1),
    1.0
  ];

  for (let sensor of webSensors) {
    sensoryArray.push(sensor.val);
  }

  return sensoryArray;
}

function giveFeedback(amount) {
  if (!lastDecision) {
    setStatus("Speak first before giving feedback");
    return;
  }

  genesis.learn(lastDecision, amount);
  lastReward = amount;
  episodeScore += amount;
  saveLocalBrain();

  setStatus(amount > 0 ? "Positive language feedback learned" : "Negative feedback learned");
}

function finishGeneration() {
  if (episodeScore > bestFitness) {
    bestFitness = episodeScore;
    bestBrainData = genesis.serialize();
    setStatus("Preserved top performing language brain");
  } else if (bestBrainData && episodeScore < bestFitness * 0.65) {
    genesis = DynamicBrain.fromData(bestBrainData);
    setStatus("Restored best language brain");
  }

  genesis.generation++;
  genesis.mutateTopology();

  episodeSteps = 0;
  episodeScore = 0;
  genesis.actionCounts = Array(VOCABULARY.length).fill(0);
}

// =============================================================================
// DYNAMIC WEB PARSING & WORLD SENSORS
// =============================================================================

function loadWorldMemory() {
  try {
    const saved = localStorage.getItem(WORLD_MEMORY_KEY);
    if (saved) worldMemory = JSON.parse(saved);
    if (!Array.isArray(worldMemory)) worldMemory = [];
  } catch (err) {
    worldMemory = [];
  }
}

function saveWorldMemory() {
  try {
    worldMemory = worldMemory.slice(0, MAX_WORLD_MEMORY);
    localStorage.setItem(WORLD_MEMORY_KEY, JSON.stringify(worldMemory));
  } catch (err) {
    setStatus("World memory unavailable");
  }
}

function recordWorldObservation(id, value, sourceUrl) {
  const observation = {
    id: id, value: value, sourceUrl: sourceUrl || "", observedAt: new Date().toISOString()
  };
  worldMemory.unshift(observation);
  worldMemory = worldMemory.slice(0, MAX_WORLD_MEMORY);
}

async function fetchWorldJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return await response.json();
}

function setProviderStatus(provider, message) {
  worldSourceStatus[provider] = message;
}

async function scanNextProvider() {
  if (worldScanBusy) return;

  const provider = WORLD_PROVIDER_ORDER[worldScanIndex % WORLD_PROVIDER_ORDER.length];
  worldScanIndex++;

  const now = Date.now();
  const lastFetch = worldProviderLastFetch[provider] || 0;
  const cooldown = WORLD_PROVIDER_COOLDOWN[provider] || 60000;

  if (now - lastFetch < cooldown) {
    setProviderStatus(provider, "Cooling down");
    return;
  }

  worldScanBusy = true;
  worldProviderLastFetch[provider] = now;
  setProviderStatus(provider, "Retrieving...");
  setStatus("Genesis absorbing text from: " + provider);

  try {
    await WORLD_FETCHERS[provider]();
    setProviderStatus(provider, "Online");
    setStatus("Extracted new vocabulary from " + provider);
  } catch (err) {
    setProviderStatus(provider, "Failed: " + err.message);
  }

  worldScanBusy = false;
  saveWorldMemory();
}

// --- DYNAMIC WEB TEXT PARSERS ---

async function fetchWikipedia() {
  const url = "https://en.wikipedia.org/api/rest_v1/page/random/summary";
  const data = await fetchWorldJSON(url);
  if (data.extract) ingestSourceText("Wikipedia", data.extract, data.content_urls?.desktop?.page || url);
}

async function fetchHackerNews() {
  const url = "https://hacker-news.firebaseio.com/v0/topstories.json";
  const ids = await fetchWorldJSON(url);
  if (ids && ids.length) {
    const items = await Promise.all(ids.slice(0, 5).map(id =>
      fetchWorldJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    ));
    const titles = items.filter(item => item && item.title).map(item => item.title);
    if (titles.length) ingestSourceText("Hacker News", titles.join(". "), "https://news.ycombinator.com/");
  }
}

async function fetchNASAImage() {
  const url = "https://science.nasa.gov/wp-json/wp/v2/apod-basic/?per_page=1";
  const result = await fetchWorldJSON(url);
  const data = Array.isArray(result) ? result[0] : result;
  if (data && data.title) {
    const title = typeof data.title === "string" ? data.title : data.title.rendered;
    ingestSourceText("NASA", title, data.link || url);
  }
}

function extractTextToVocabulary(text) {
  let cleanWords = text.toLowerCase().match(/[a-z]+/g) || [];
  let previousSize = VOCABULARY.length;
  for (let w of cleanWords) {
    if (w.length <= 20) {
      addWordToVocabulary(w);
    }
  }
  return VOCABULARY.length - previousSize;
}

function ingestSourceText(source, text, sourceUrl) {
  const content = String(text || "").trim();
  if (!content) return 0;
  if (languageEvaluator) languageEvaluator.updateWebContext(content);
  const addedWords = extractTextToVocabulary(content);
  const trainedExamples = trainOnSourceText(content);
  recordWorldObservation(source, content.slice(0, 600), sourceUrl);
  webSensors[5].val = constrain(webSensors[5].val + Math.min(content.length / 3000, 0.2), -1, 1);
  if (trainedExamples > 0) saveLocalBrain();
  return addedWords;
}

function trainOnSourceText(text) {
  if (!genesis) return 0;

  let examples = 0;

  const sentences = String(text).toLowerCase().split(/[.!?]+/);
  for (const sentence of sentences) {
    if (examples >= 80) break;
    const words = (sentence.match(/[a-z]+/g) || []).filter(word => word.length <= 20);
    const wordIndices = words.map(word => VOCABULARY.indexOf(word));
    const stride = Math.max(1, Math.ceil(words.length / (80 - examples)));

    for (let targetPosition = 0; targetPosition < wordIndices.length && examples < 80; targetPosition += stride) {
      const contextIndices = [
        wordIndices[targetPosition - 3] ?? 0,
        wordIndices[targetPosition - 2] ?? 0,
        wordIndices[targetPosition - 1] ?? 0
      ];
      const contextValues = contextIndices.map(index => (index / VOCABULARY.length) * 2 - 1);
      const inputs = [
        0, 0, 0,
        ...contextValues,
        0, 0, 0, 0, 1,
        ...webSensors.map(sensor => sensor.val)
      ];

      while (genesis.inputNodes.length < inputs.length) genesis.addInputNode();

      const target = wordIndices[targetPosition];
      const probabilities = softmax(genesis.feedForward(inputs).slice(0, VOCABULARY.length));
      genesis.learn({ action: target, probabilities }, 1.0);
      examples++;
    }
  }

  trainingExampleCount += examples;
  return examples;
}

class WebLanguageEvaluator {
  constructor() {
    this.activeWebKeywords = new Set();
    this.recentWords = [];
    this.maxRecentWords = 8;
    this.wordCategories = {
      nouns: new Set([
        "world", "data", "system", "pulse", "orbit", "earth", "memory", "light", "time", "network"
      ]),
      verbs: new Set([
        "expands", "runs", "signals", "grows", "connects", "rotates", "reads", "stores"
      ]),
      adjectives: new Set([
        "solar", "active", "global", "bright", "dense", "recurrent", "deep"
      ])
    };
  }

  updateWebContext(rawText) {
    const words = rawText.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
    this.activeWebKeywords = new Set(words.filter(word => word.length > 4));
  }

  evaluateStep(word, lastWord) {
    let reward = 0;
    const cleanWord = word.toLowerCase().trim();
    const cleanLast = lastWord ? lastWord.toLowerCase().trim() : "";

    if (this.activeWebKeywords.has(cleanWord)) reward += 0.7;

    const lastType = this.getPOS(cleanLast);
    const currentType = this.getPOS(cleanWord);
    if (lastType === "adjective" && currentType === "noun") reward += 0.5;
    if (lastType === "noun" && currentType === "verb") reward += 0.5;
    if (lastType === "verb" && currentType === "verb") reward -= 0.6;

    const repeatCount = this.recentWords.filter(recentWord => recentWord === cleanWord).length;
    if (repeatCount > 3) reward -= 0.8;

    this.recentWords.push(cleanWord);
    if (this.recentWords.length > this.maxRecentWords) this.recentWords.shift();

    return constrain(reward, -1.0, 1.0);
  }

  getPOS(word) {
    if (this.wordCategories.nouns.has(word)) return "noun";
    if (this.wordCategories.verbs.has(word)) return "verb";
    if (this.wordCategories.adjectives.has(word)) return "adjective";
    return "unknown";
  }
}

function setSensorFromRange(index, value, min, max) {
  if (Number.isFinite(value)) {
    webSensors[index].val = constrain(((value - min) / (max - min)) * 2 - 1, -1, 1);
  }
}

async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${GENESIS_LOCATION.latitude}&longitude=${GENESIS_LOCATION.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const data = await fetchWorldJSON(url);
  const current = data.current;
  if (!current) throw new Error("No current weather data");

  const temperature = current.temperature_2m;
  const humidity = current.relative_humidity_2m;
  const wind = current.wind_speed_10m;
  const code = current.weather_code;
  const conditions = code === 0 ? "clear sunshine" : code <= 3 ? "partly cloudy" : code <= 48 ? "foggy conditions" : code <= 67 ? "rain showers" : code <= 77 ? "snow showers" : code <= 82 ? "rain showers" : "thunderstorms";
  setSensorFromRange(0, temperature, -30, 45);
  setSensorFromRange(1, humidity, 0, 100);
  setSensorFromRange(2, wind, 0, 100);
  ingestSourceText("Weather", `${conditions} temperature ${temperature} humidity ${humidity} wind ${wind}`, url);
}

async function fetchAirQuality() {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${GENESIS_LOCATION.latitude}&longitude=${GENESIS_LOCATION.longitude}&current=us_aqi,pm2_5,pm10`;
  const data = await fetchWorldJSON(url);
  const current = data.current;
  if (!current) throw new Error("No current air-quality data");

  const aqi = current.us_aqi;
  const quality = aqi <= 50 ? "good air quality" : aqi <= 100 ? "moderate air quality" : aqi <= 150 ? "unhealthy air quality" : "poor air quality";
  setSensorFromRange(3, aqi, 0, 200);
  ingestSourceText("Air quality", `${quality} AQI ${aqi} particulate ${current.pm2_5} ${current.pm10}`, url);
}

async function fetchEarthquakes() {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
  const data = await fetchWorldJSON(url);
  const events = (data.features || []).slice(0, 8);
  setSensorFromRange(4, events.length, 0, 20);
  const descriptions = events.map(event => event.properties?.title).filter(Boolean);
  if (descriptions.length) {
    ingestSourceText("Earthquakes", descriptions.join(". "), url);
  } else {
    recordWorldObservation("Earthquakes", "No magnitude 2.5 or greater events in the past day", url);
  }
}

async function fetchSpaceWeather() {
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000);
  const formatDate = date => date.toISOString().slice(0, 10);
  const url = `https://api.nasa.gov/DONKI/CME?startDate=${formatDate(start)}&endDate=${formatDate(end)}&api_key=DEMO_KEY`;
  const events = await fetchWorldJSON(url);
  const descriptions = (Array.isArray(events) ? events : []).slice(0, 8).map(event =>
    event.cmeAnalyses?.[0]?.note || event.catalog || "solar coronal mass ejection"
  );
  if (descriptions.length) ingestSourceText("NASA space weather", descriptions.join(". "), url);
  else recordWorldObservation("NASA space weather", "No recent coronal mass ejection reports", url);
}

async function fetchWorldBank() {
  const url = "https://api.worldbank.org/v2/country?format=json&per_page=300";
  const data = await fetchWorldJSON(url);
  const countries = Array.isArray(data?.[1]) ? data[1] : [];
  const names = countries.slice(0, 80).map(country =>
    `${country.name || ""} ${country.region?.value || ""} ${country.incomeLevel?.value || ""}`
  );
  if (names.length) ingestSourceText("World Bank", names.join(". "), url);
}

async function fetchCountries() {
  const url = "https://restcountries.com/v3.1/all?fields=name,capital,region,subregion,languages";
  const data = await fetchWorldJSON(url);
  const descriptions = (Array.isArray(data) ? data : []).slice(0, 80).map(country => {
    const languages = Object.values(country.languages || {}).join(" ");
    return `${country.name?.common || ""} ${country.capital?.join(" ") || ""} ${country.region || ""} ${country.subregion || ""} ${languages}`;
  });
  if (descriptions.length) ingestSourceText("Countries", descriptions.join(". "), url);
}

async function fetchGitHub() {
  const topics = ["creative-coding", "language-model", "generative-art", "p5js", "artificial-intelligence"];
  const topic = random(topics);
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=updated&per_page=10`;
  const data = await fetchWorldJSON(url);
  const descriptions = (data.items || []).map(repo =>
    `${repo.name || ""} ${repo.description || ""} ${(repo.topics || []).join(" ")}`
  );
  if (descriptions.length) ingestSourceText("GitHub", descriptions.join(". "), url);
}

async function fetchOpenLibrary() {
  const subjects = ["science", "nature", "poetry", "mythology", "astronomy", "folklore"];
  const subject = random(subjects);
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=20`;
  const data = await fetchWorldJSON(url);
  const descriptions = (data.works || []).map(work =>
    `${work.title || ""} ${(work.authors || []).map(author => author.name).join(" ")}`
  );
  if (descriptions.length) ingestSourceText("Open Library", descriptions.join(". "), url);
}

async function fetchMetMuseum() {
  const queries = ["moon", "bird", "flower", "water", "landscape", "star"];
  const query = random(queries);
  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(query)}`;
  const search = await fetchWorldJSON(searchUrl);
  const ids = (search.objectIDs || []).slice(0, 4);
  const objects = await Promise.all(ids.map(id =>
    fetchWorldJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
  ));
  const descriptions = objects.map(object =>
    `${object.title || ""} ${object.culture || ""} ${object.period || ""} ${object.medium || ""}`
  ).filter(text => text.trim());
  if (descriptions.length) ingestSourceText("Met Museum", descriptions.join(". "), searchUrl);
}

const WORLD_FETCHERS = {
  weather: fetchWeather, air: fetchAirQuality, earthquake: fetchEarthquakes,
  apod: fetchNASAImage, donki: fetchSpaceWeather, worldbank: fetchWorldBank,
  countries: fetchCountries, wikipedia: fetchWikipedia, github: fetchGitHub,
  hackernews: fetchHackerNews, openlibrary: fetchOpenLibrary, metmuseum: fetchMetMuseum
};

// =============================================================================
// MATH & UTILS
// =============================================================================

function softmax(values) {
  let maxValue = Math.max(...values);
  let exps = values.map(v => Math.exp(constrain(v - maxValue, -20, 20)));
  let sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(v => v / sum);
}

function sampleChoice(probabilities) {
  let r = random(1);
  for (let i = 0; i < probabilities.length; i++) {
    r -= probabilities[i];
    if (r <= 0) return i;
  }
  return probabilities.length - 1;
}

// =============================================================================
// DYNAMIC NEURAL NETWORK ARCHITECTURE
// =============================================================================

class Node {
  constructor(id, type, layer) {
    this.id = id;
    this.type = type;
    this.layer = layer;
    this.value = 0;
    this.bias = type === "input" ? 0 : random(-0.3, 0.3);
  }
}

class Connection {
  constructor(from, to, weight) {
    this.from = from;
    this.to = to;
    this.weight = weight;
    this.enabled = true;
  }
}

class DynamicBrain {
  constructor(inputCount, outputCount, hiddenCount) {
    this.nodes = [];
    this.connections = [];
    this.nodeCounter = 0;
    this.generation = 1;
    this.learningRate = 0.025;
    this.actionCounts = Array(VOCABULARY.length).fill(0);
    this.inputNodes = [];
    this.outputNodes = [];

    for (let i = 0; i < inputCount; i++) {
      let n = new Node(this.nodeCounter++, "input", 0);
      this.nodes.push(n);
      this.inputNodes.push(n);
    }

    for (let i = 0; i < hiddenCount; i++) {
      this.nodes.push(new Node(this.nodeCounter++, "hidden", 1));
    }

    for (let i = 0; i < outputCount; i++) {
      let n = new Node(this.nodeCounter++, "output", 2);
      this.nodes.push(n);
      this.outputNodes.push(n);
    }

    let hidden = this.nodes.filter(n => n.type === "hidden");
    for (let input of this.inputNodes) {
      for (let h of hidden) {
        this.connections.push(new Connection(input, h, random(-1, 1)));
      }
    }

    for (let h of hidden) {
      for (let output of this.outputNodes) {
        this.connections.push(new Connection(h, output, random(-1, 1)));
      }
    }
  }

  addInputNode() {
    let newInput = new Node(this.nodeCounter++, "input", 0);
    this.nodes.push(newInput);
    this.inputNodes.push(newInput);

    let hidden = this.nodes.filter(n => n.type === "hidden");
    for (let h of hidden) {
      this.connections.push(new Connection(newInput, h, random(-1, 1)));
    }
  }

  addOutputNode() {
    let newOutput = new Node(this.nodeCounter++, "output", 2);
    this.nodes.push(newOutput);
    this.outputNodes.push(newOutput);
    this.actionCounts.push(0);

    let hidden = this.nodes.filter(n => n.type === "hidden");
    for (let h of hidden) {
      this.connections.push(new Connection(h, newOutput, random(-1, 1)));
    }
  }

  feedForward(inputValues) {
    for (let n of this.nodes) n.value = 0;
    for (let i = 0; i < this.inputNodes.length; i++) {
      this.inputNodes[i].value = inputValues[i] || 0;
    }

    let ordered = [...this.nodes].sort((a, b) => a.layer - b.layer);

    for (let node of ordered) {
      if (node.type === "input") continue;

      let sum = node.bias;
      for (let c of this.connections) {
        if (c.enabled && c.to === node) {
          sum += c.from.value * c.weight;
        }
      }
      node.value = node.type === "output" ? sum : Math.tanh(sum);
    }

    return this.outputNodes.map(n => n.value);
  }

  learn(decision, reward) {
    if (!decision) return;

    let probs = decision.probabilities;
    let action = decision.action;
    let scale = this.learningRate * constrain(reward, -1, 1);

    for (let i = 0; i < VOCABULARY.length; i++) {
      let gradient = (i === action ? 1 : 0) - (probs[i] || 0);
      let output = this.outputNodes[i];
      if (!output) continue;
      output.bias += scale * gradient;

      for (let c of this.connections) {
        if (c.enabled && c.to === output) {
          c.weight += scale * gradient * c.from.value;
        }
      }
    }
  }

  addNode() {
    let active = this.connections.filter(c => c.enabled && c.from.layer < c.to.layer);
    if (active.length === 0) return;

    let conn = random(active);
    conn.enabled = false;

    let middleLayer = (conn.from.layer + conn.to.layer) / 2;
    let node = new Node(this.nodeCounter++, "hidden", middleLayer);

    this.nodes.push(node);
    this.connections.push(new Connection(conn.from, node, 1));
    this.connections.push(new Connection(node, conn.to, conn.weight));
  }

  addConnection() {
    let possible = [];
    for (let a of this.nodes) {
      for (let b of this.nodes) {
        if (a.layer >= b.layer || b.type === "input" || a.type === "output") continue;

        let exists = this.connections.some(c => c.from === a && c.to === b);
        if (!exists) possible.push([a, b]);
      }
    }

    if (possible.length === 0) return;
    let pair = random(possible);
    this.connections.push(new Connection(pair[0], pair[1], random(-1, 1)));
  }

  mutateTopology() {
    let r = random();
    if (r < 0.35) {
      this.addConnection();
    } else if (r < 0.65) {
      this.addNode();
    } else {
      for (let c of this.connections) {
        if (random() < 0.8) c.weight += randomGaussian() * 0.12;
      }
      for (let n of this.nodes) {
        if (n.type !== "input" && random() < 0.7) {
          n.bias += randomGaussian() * 0.08;
        }
      }
    }
  }

  drawNetwork(x, y, w, h) {
    let layers = [...new Set(this.nodes.map(n => n.layer))].sort((a, b) => a - b);
    let positions = new Map();

    for (let li = 0; li < layers.length; li++) {
      let layer = layers[li];
      let group = this.nodes.filter(n => n.layer === layer);
      let px = x + 12 + (layers.length <= 1 ? 0 : li / (layers.length - 1)) * (w - 24);

      for (let i = 0; i < group.length; i++) {
        let py = y + 10 + ((i + 1) / (group.length + 1)) * (h - 20);
        positions.set(group[i].id, { x: px, y: py });
      }
    }

    for (let c of this.connections) {
      let a = positions.get(c.from.id);
      let b = positions.get(c.to.id);
      if (!a || !b) continue;

      if (!c.enabled) {
        stroke(75, 55);
        strokeWeight(0.7);
      } else {
        stroke(c.weight >= 0 ? color(50, 180, 220, 180) : color(230, 95, 95, 180));
        strokeWeight(constrain(abs(c.weight) * 1.1, 0.5, 3));
      }
      line(a.x, a.y, b.x, b.y);
    }

    for (let n of this.nodes) {
      let p = positions.get(n.id);
      if (!p) continue;

      noStroke();
      if (n.type === "input") fill(65, 210, 130);
      else if (n.type === "output") fill(245, 165, 70);
      else fill(190, 200, 220);

      circle(p.x, p.y, n.type === "hidden" ? 7 : 9);
    }
  }

  serialize() {
    return {
      version: 6,
      generation: this.generation,
      nodeCounter: this.nodeCounter,
      learningRate: this.learningRate,
      vocabulary: [...VOCABULARY],
      nodes: this.nodes.map(n => ({ id: n.id, type: n.type, layer: n.layer, bias: n.bias })),
      connections: this.connections.map(c => ({ from: c.from.id, to: c.to.id, weight: c.weight, enabled: c.enabled })),
      actionCounts: [...this.actionCounts]
    };
  }

  static fromData(data) {
    let brain = Object.create(DynamicBrain.prototype);
    brain.nodes = [];
    brain.connections = [];
    brain.nodeCounter = data.nodeCounter || 0;
    brain.generation = data.generation || 1;
    brain.learningRate = data.learningRate || 0.025;

    if (data.vocabulary && Array.isArray(data.vocabulary)) {
      VOCABULARY = data.vocabulary;
    }

    brain.actionCounts = data.actionCounts || Array(VOCABULARY.length).fill(0);

    let byId = new Map();
    for (let saved of data.nodes || []) {
      let n = new Node(saved.id, saved.type, saved.layer);
      n.bias = saved.bias || 0;
      brain.nodes.push(n);
      byId.set(n.id, n);
    }

    for (let saved of data.connections || []) {
      let from = byId.get(saved.from);
      let to = byId.get(saved.to);
      if (from && to) {
        let c = new Connection(from, to, saved.weight);
        c.enabled = saved.enabled !== false;
        brain.connections.push(c);
      }
    }

    brain.inputNodes = brain.nodes.filter(n => n.type === "input");
    brain.outputNodes = brain.nodes.filter(n => n.type === "output");
    return brain;
  }
}

// =============================================================================
// STORAGE & FILE HANDLING
// =============================================================================

function buildSaveData() {
  return {
    project: "Project Genesis V6",
    version: 6,
    savedAt: new Date().toISOString(),
    brain: genesis.serialize(),
    totalSteps: totalSteps,
    trainingExampleCount: trainingExampleCount,
    bestFitness: bestFitness,
    bestBrainData: bestBrainData
  };
}

function saveLocalBrain() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData()));
  } catch (err) {
    setStatus("Storage full. Export brain.");
  }
}

function loadLocalBrain() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let data = JSON.parse(raw);
    if (data.brain && data.brain.nodes && data.brain.connections) {
      genesis = DynamicBrain.fromData(data.brain);
      totalSteps = data.totalSteps || 0;
      trainingExampleCount = data.trainingExampleCount || 0;
      bestFitness = data.bestFitness ?? -Infinity;
      bestBrainData = data.bestBrainData || null;
      setStatus("Previous V6 language brain restored");
    }
  } catch (err) {
    setStatus("Could not load previous brain");
  }
}

function exportBrain() {
  saveJSON(buildSaveData(), "project_genesis_v6_language_brain.json");
  setStatus("Language brain exported");
}

function handleBrainFile(file) {
  if (file.subtype !== "json") {
    setStatus("Choose a JSON file");
    return;
  }

  try {
    let data = typeof file.data === "string" ? JSON.parse(file.data) : file.data;
    let savedBrain = data.brain || data;

    if (!savedBrain.nodes || !savedBrain.connections) {
      throw new Error("Invalid brain structure");
    }

    genesis = DynamicBrain.fromData(savedBrain);
    totalSteps = data.totalSteps || 0;
    trainingExampleCount = data.trainingExampleCount || 0;
    bestFitness = data.bestFitness ?? -Infinity;
    bestBrainData = data.bestBrainData || null;

    saveLocalBrain();
    setStatus("Language brain imported successfully");
  } catch (err) {
    setStatus("Import failed");
  }
}

function setStatus(message) {
  statusMessage = message;
  statusTimer = 240;
}