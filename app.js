// ========== CONFIGURATION ==========

// OpenWeatherMap API key
const apiKey = "04b990fa2304ec9c562b1f3f555d898e";

// Get browser language (first 2 letters)
const browserLang = navigator.language.slice(0, 2);
document.documentElement.lang = browserLang;

// Base URL for reverse geocoding with OpenStreetMap
const nominatimBase = "https://nominatim.openstreetmap.org/reverse";

// ========== DOM ELEMENTS ==========

const cityInputEl = document.getElementById("cityInput");
const searchBtnEl = document.getElementById("searchBtn");
const geoBtnEl = document.getElementById("geoBtn");
const suggestionsEl = document.getElementById("suggestions");
const weatherEl = document.getElementById("weather");
const errorEl = document.getElementById("error");

// ========== ERROR HANDLING ==========

// Show error message
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

// Hide error message
function clearError() {
  errorEl.classList.add("hidden");
  errorEl.textContent = "";
}

// Hide weather block
function clearWeather() {
  weatherEl.classList.add("hidden");
  weatherEl.innerHTML = "";
}

// ========== THEME UPDATE (OPTIONAL) ==========

// Add class to body based on temperature
function updateTheme(tempC) {
  const body = document.body;
  body.className = ""; // Reset all classes

  if (tempC <= 0) body.classList.add("theme-cold");
  else if (tempC <= 15) body.classList.add("theme-mild");
  else if (tempC <= 25) body.classList.add("theme-warm");
  else body.classList.add("theme-hot");
}

// ========== DISPLAY WEATHER INFO ==========

function displayWeather(data, cityName) {
  const temp = Math.round(data.main.temp);
  const desc = data.weather?.[0]?.description ?? "";
  const icon = data.weather?.[0]?.icon ?? "01d";
  const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;

  // Convert UTC to local time using timezone offset
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const cityTime = new Date(utc + data.timezone * 1000);
  const timeNow = cityTime.toLocaleTimeString(browserLang, {
    hour: "2-digit",
    minute: "2-digit",
  });

  updateTheme(temp);

  // Inject weather HTML into DOM
  weatherEl.innerHTML = `
    <div class="weather-location">${cityName ?? data.name}</div>
    <div class="weather-time">Now: ${timeNow}</div>
    <div class="weather-main">
      <img class="weather-icon" src="${iconUrl}" alt="${desc}">
      <div class="weather-temp">${temp}°</div>
      <div class="weather-desc">${desc}</div>
    </div>
    <div class="weather-extra">
      <div class="weather-extra-item">Humidity <span>${data.main.humidity}%</span></div>
      <div class="weather-extra-item">Wind <span>${data.wind.speed} m/s</span></div>
    </div>
  `;

  weatherEl.classList.remove("hidden");

  // Load forecast
  getForecast(data.coord.lat, data.coord.lon, temp, icon, data.timezone);
}

// ========== HOURLY FORECAST ==========

function getForecast(lat, lon, currentTemp, currentIcon, timezoneOffset) {
  fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${browserLang}`)
    .then((res) => res.json())
    .then((data) => {
      const forecastBlock = document.createElement("div");
      forecastBlock.classList.add("forecast-block");

      // Current weather
      const nowItem = document.createElement("div");
      nowItem.classList.add("forecast-item");
      nowItem.innerHTML = `
        <div>Now</div>
        <img src="https://openweathermap.org/img/wn/${currentIcon}.png" alt="icon">
        <div>${Math.round(currentTemp)}°</div>
      `;
      forecastBlock.appendChild(nowItem);

      // Filter and show next 5 forecasted hours
      const cityNow = new Date(Date.now() + timezoneOffset * 1000);
      const hourly = data.list.filter(f => new Date(f.dt * 1000) > cityNow).slice(0, 5);

      hourly.forEach(hour => {
        const time = new Date((hour.dt + timezoneOffset) * 1000).toLocaleTimeString(browserLang, {
          hour: "2-digit",
          minute: "2-digit",
        });

        const iconUrl = `https://openweathermap.org/img/wn/${hour.weather[0].icon}.png`;

        const item = document.createElement("div");
        item.classList.add("forecast-item");
        item.innerHTML = `
          <div>${time}</div>
          <img src="${iconUrl}" alt="icon">
          <div>${Math.round(hour.main.temp)}°</div>
        `;
        forecastBlock.appendChild(item);
      });

      weatherEl.appendChild(forecastBlock);
    });
}

// ========== SEARCH BY CITY NAME ==========

function getWeather() {
  const city = cityInputEl.value.trim();
  if (!city) return;

  clearError();
  clearWeather();

  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=${browserLang}`)
    .then(res => res.json())
    .then(data => {
      if (data.cod !== 200) return showError("❌ City not found.");
      displayWeather(data);
      cityInputEl.blur();
    })
    .catch(() => showError("⚠️ Failed to fetch data."));
}

// ========== SEARCH BY USER LOCATION (Geolocation) ==========

function getWeatherByLocation() {
  clearError();
  clearWeather();

  if (!navigator.geolocation) return showError("❌ Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const { latitude, longitude } = coords;

      // Fetch weather using coordinates
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=${browserLang}`)
        .then(res => res.json())
        .then(weatherData => {
          if (weatherData.cod !== 200) return showError("❌ Weather not found for coordinates.");

          // Use OpenStreetMap to get more precise location name
          fetch(`${nominatimBase}?lat=${latitude}&lon=${longitude}&format=json&accept-language=${browserLang}`)
            .then(res => res.json())
            .then(locationData => {
              const a = locationData.address || {};
              const cityName =
                a.city || a.town || a.village || a.hamlet || a.municipality ||
                a.suburb || a.county || a.state_district || locationData.name || "Your Location";

              displayWeather(weatherData, cityName);
            })
            .catch(() => {
              // Fallback if Nominatim fails
              displayWeather(weatherData, weatherData.name);
            });
        })
        .catch(() => showError("⚠️ Failed to fetch weather."));
    },
    () => showError("❌ Please allow location access.")
  );
}

// ========== AUTOCOMPLETE CITY INPUT ==========

let autocompleteAbortController = null;

cityInputEl.addEventListener("input", () => {
  const input = cityInputEl.value.trim();
  if (input.length < 2) {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
    return;
  }

  // Cancel previous autocomplete request
  if (autocompleteAbortController) autocompleteAbortController.abort();
  autocompleteAbortController = new AbortController();

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(input)}&limit=5&appid=${apiKey}`, {
    signal: autocompleteAbortController.signal
  })
    .then(res => res.json())
    .then(data => {
      suggestionsEl.innerHTML = "";
      if (!data.length) return suggestionsEl.classList.add("hidden");

      data.forEach(place => {
        const label = `${place.name}${place.state ? `, ${place.state}` : ""}, ${place.country}`;
        const div = document.createElement("div");
        div.textContent = label;
        div.addEventListener("click", () => {
          cityInputEl.value = place.name;
          suggestionsEl.classList.add("hidden");
          getWeather();
        });
        suggestionsEl.appendChild(div);
      });

      suggestionsEl.classList.remove("hidden");
    })
    .catch(err => {
      if (err.name !== "AbortError") console.error(err);
    });
});

// Hide suggestions when clicking outside
document.addEventListener("click", e => {
  if (!e.target.closest(".search-box")) {
    suggestionsEl.innerHTML = "";
    suggestionsEl.classList.add("hidden");
  }
});

// ========== EVENT LISTENERS ==========

searchBtnEl.addEventListener("click", getWeather);
geoBtnEl.addEventListener("click", getWeatherByLocation);
cityInputEl.addEventListener("keydown", e => {
  if (e.key === "Enter") getWeather();
});

// Optional: fetch weather automatically on page load
// window.addEventListener("load", () => {
//   getWeatherByLocation();
// });
