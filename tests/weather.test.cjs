const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');

function makeElement() {
  return {
    className: '', textContent: '', value: '', children: [],
    classList: { add() {}, remove() {} },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
    blur() {},
    closest() { return null; }
  };
}
function setup(fetchImpl) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const document = {
    documentElement: { lang: '' }, body: { className: '' },
    getElementById: get, createElement: makeElement,
    createDocumentFragment: makeElement, addEventListener() {}
  };
  const context = vm.createContext({
    document,
    navigator: { language: 'en-US', geolocation: null },
    fetch: fetchImpl,
    URLSearchParams,
    Intl,
    Date,
    console,
    AbortController
  });
  vm.runInContext(source, context);
  return { context, get, document };
}
test('no hard-coded provider secret or old authenticated endpoint', () => {
  assert.doesNotMatch(source, /appid=|apiKey|api\.openweathermap\.org/i);
  assert.match(source, /api\.open-meteo\.com/);
});
test('maps weather categories consistently', () => {
  const { context } = setup(async () => { throw new Error('Unexpected request'); });
  assert.equal(context.weatherDescription(0)[0], 'Clear sky');
  assert.equal(context.weatherDescription(65)[0], 'Rain');
  assert.equal(context.weatherDescription(75)[0], 'Snow');
});
test('fetches a city and renders weather without interpreting city label as HTML', async () => {
  const requested = [];
  const fetchMock = async url => {
    requested.push(String(url));
    const payload = String(url).includes('geocoding-api')
      ? { results: [{ name: '<b>Vienna</b>', country: 'Austria', latitude: 48.2, longitude: 16.3 }] }
      : {
        timezone: 'Europe/Vienna',
        current: { time: '2026-11-02T12:15', temperature_2m: 10, relative_humidity_2m: 70, weather_code: 3, wind_speed_10m: 2 },
        hourly: { time: ['2026-11-02T12:00','2026-11-02T13:00'],temperature_2m:[10,11],weather_code:[3,2] }
      };
    return { ok: true, json: async () => payload };
  };
  const { context, get } = setup(fetchMock);
  get('cityInput').value = 'Vienna';
  await context.getWeather();
  assert.equal(requested.length, 2);
  assert.equal(get('weather').children[0].children[0].textContent, '<b>Vienna</b>, Austria');
  assert.equal(get('weather').children[0].children[2].children[1].textContent, '10°');
});
test('shows a readable error on provider failure', async () => {
  const { context, get } = setup(async () => { throw new Error('offline'); });
  get('cityInput').value = 'Vienna';
  await context.getWeather();
  assert.match(get('error').textContent, /Failed to fetch weather/);
});
