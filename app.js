// Weather data: Open-Meteo (no client-side API secret).
// Open-Meteo free API is intended for non-commercial use; see its terms.
const browserLang = navigator.language.slice(0, 2);
document.documentElement.lang = browserLang;
const geocodeApi = "https://geocoding-api.open-meteo.com/v1/search";
const forecastApi = "https://api.open-meteo.com/v1/forecast";
const nominatimBase = "https://nominatim.openstreetmap.org/reverse";
const cityInputEl = document.getElementById("cityInput");
const searchBtnEl = document.getElementById("searchBtn");
const geoBtnEl = document.getElementById("geoBtn");
const suggestionsEl = document.getElementById("suggestions");
const weatherEl = document.getElementById("weather");
const errorEl = document.getElementById("error");

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}
function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}
function clearWeather() {
  weatherEl.replaceChildren();
  weatherEl.classList.add("hidden");
}
function updateTheme(temp) {
  document.body.className = temp <= 0 ? "theme-cold" : temp <= 15 ? "theme-mild" : temp <= 25 ? "theme-warm" : "theme-hot";
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
function weatherDescription(code) {
  if (code === 0) return ["Clear sky", "☀️"];
  if ([1, 2].includes(code)) return ["Partly cloudy", "🌤️"];
  if (code === 3) return ["Overcast", "☁️"];
  if ([45, 48].includes(code)) return ["Fog", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Drizzle", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Rain", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Snow", "❄️"];
  if ([95, 96, 99].includes(code)) return ["Thunderstorm", "⛈️"];
  return ["Weather conditions", "🌡️"];
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function formatLocalTime(zone) {
  return new Intl.DateTimeFormat(browserLang, { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(new Date());
}
async function displayWeather(lat, lon, label) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code",
    wind_speed_unit: "ms",
    timezone: "auto",
    forecast_days: "2"
  });
  const data = await fetchJson(forecastApi + "?" + params);
  if (!data.current || !data.hourly) throw new Error("Missing weather data");
  const current = data.current;
  const temp = Math.round(current.temperature_2m);
  const [description, icon] = weatherDescription(current.weather_code);
  updateTheme(temp);
  const card = document.createDocumentFragment();
  card.appendChild(element("div", "weather-location", label));
  card.appendChild(element("div", "weather-time", "Now: " + formatLocalTime(data.timezone)));
  const main = element("div", "weather-main");
  main.appendChild(element("span", "weather-icon", icon));
  main.appendChild(element("div", "weather-temp", temp + "°"));
  main.appendChild(element("div", "weather-desc", description));
  card.appendChild(main);
  const extra = element("div", "weather-extra");
  extra.appendChild(element("div", "weather-extra-item", "Humidity " + Math.round(current.relative_humidity_2m) + "%"));
  extra.appendChild(element("div", "weather-extra-item", "Wind " + current.wind_speed_10m + " m/s"));
  card.appendChild(extra);
  const forecast = element("div", "forecast-block");
  const currentHour = current.time.slice(0, 13);
  const upcoming = data.hourly.time.map((time, index) => ({ time, index })).filter(item => item.time.slice(0, 13) > currentHour).slice(0, 5);
  for (const item of upcoming) {
    const row = element("div", "forecast-item");
    row.appendChild(element("div", "", item.time.slice(11, 16)));
    row.appendChild(element("span", "", weatherDescription(data.hourly.weather_code[item.index])[1]));
    row.appendChild(element("div", "", Math.round(data.hourly.temperature_2m[item.index]) + "°"));
    forecast.appendChild(row);
  }
  card.appendChild(forecast);
  weatherEl.replaceChildren(card);
  weatherEl.classList.remove("hidden");
}
async function searchLocations(query, count = 5, options = {}) {
  const params = new URLSearchParams({ name: query, count: String(count), language: browserLang, format: "json" });
  const data = await fetchJson(geocodeApi + "?" + params, options);
  return data.results || [];
}
async function getWeather() {
  const city = cityInputEl.value.trim();
  if (!city) return;
  clearError(); clearWeather();
  try {
    const places = await searchLocations(city, 1);
    if (!places.length) return showError("❌ City not found.");
    const place = places[0];
    await displayWeather(place.latitude, place.longitude, [place.name, place.country].filter(Boolean).join(", "));
    cityInputEl.blur();
  } catch {
    showError("⚠️ Failed to fetch weather.");
  }
}
async function getWeatherByLocation() {
  clearError(); clearWeather();
  if (!navigator.geolocation) return showError("❌ Geolocation not supported.");
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    const { latitude, longitude } = coords;
    let placeName = "Your Location";
    try {
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "json", "accept-language": browserLang });
      const location = await fetchJson(nominatimBase + "?" + params);
      const a = location.address || {};
      placeName = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || placeName;
    } catch { /* Geocoding is optional. */ }
    try { await displayWeather(latitude, longitude, placeName); }
    catch { showError("⚠️ Failed to fetch weather."); }
  }, () => showError("❌ Please allow location access."));
}
let autocompleteAbortController = null;
cityInputEl.addEventListener("input", async () => {
  const input = cityInputEl.value.trim();
  if (autocompleteAbortController) autocompleteAbortController.abort();
  suggestionsEl.replaceChildren();
  suggestionsEl.classList.add("hidden");
  if (input.length < 2) return;
  autocompleteAbortController = new AbortController();
  try {
    const places = await searchLocations(input, 5, { signal: autocompleteAbortController.signal });
    for (const place of places) {
      const label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
      const node = element("div", "", label);
      node.addEventListener("click", async () => {
        cityInputEl.value = label;
        suggestionsEl.classList.add("hidden");
        clearError(); clearWeather();
        try { await displayWeather(place.latitude, place.longitude, label); }
        catch { showError("⚠️ Failed to fetch weather."); }
      });
      suggestionsEl.appendChild(node);
    }
    if (places.length) suggestionsEl.classList.remove("hidden");
  } catch (error) {
    if (error.name !== "AbortError") console.error("Geocoding unavailable", error);
  }
});
document.addEventListener("click", event => {
  if (!event.target.closest(".search-box")) {
    suggestionsEl.replaceChildren();
    suggestionsEl.classList.add("hidden");
  }
});
searchBtnEl.addEventListener("click", getWeather);
geoBtnEl.addEventListener("click", getWeatherByLocation);
cityInputEl.addEventListener("keydown", event => { if (event.key === "Enter") getWeather(); });
