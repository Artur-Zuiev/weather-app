const apiKey = "04b990fa2304ec9c562b1f3f555d898e";

// --- Elements ---
const cityInputEl   = document.getElementById('cityInput');
const searchBtnEl   = document.getElementById('searchBtn');
const suggestionsEl = document.getElementById('suggestions');
const weatherEl     = document.getElementById('weather');
const errorEl       = document.getElementById('error');

// --- Helpers ---
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function clearError() {
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

function updateTheme(tempC) {
  const body = document.body;
  body.classList.remove('theme-cold','theme-mild','theme-warm','theme-hot','theme-default');
  if (tempC <= 0) body.classList.add('theme-cold');
  else if (tempC <= 15) body.classList.add('theme-mild');
  else if (tempC <= 25) body.classList.add('theme-warm');
  else body.classList.add('theme-hot');
}

// --- Weather Fetch ---
function getWeather() {
  const rawCity = cityInputEl.value.trim();
  if (!rawCity) {
    return; // Ничего не показываем, если поле пустое
  }

  clearError();
  weatherEl.classList.add('hidden');

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(rawCity)}&appid=${apiKey}&units=metric&lang=de`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.cod !== 200) {
        showError("❌ Stadt nicht gefunden.");
        return;
      }

      clearError(); // Убираем ошибку, если всё прошло успешно

      const temp = Math.round(data.main.temp);
      const desc = data.weather?.[0]?.description ?? '';
      const name = data.name;
      const icon = data.weather?.[0]?.icon ?? '01d';
      const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;
      const humidity = data.main.humidity;
      const wind = data.wind.speed;

      updateTheme(temp);

      weatherEl.innerHTML = `
        <div class="weather-location">${name}</div>
        <div class="weather-main">
          <img class="weather-icon" src="${iconUrl}" alt="${desc}">
          <div class="weather-temp">${temp}°</div>
          <div class="weather-desc">${desc}</div>
        </div>
        <div class="weather-extra">
          <div class="weather-extra-item">
            Luftfeuchte
            <span>${humidity}%</span>
          </div>
          <div class="weather-extra-item">
            Wind
            <span>${wind} m/s</span>
          </div>
        </div>
      `;
      weatherEl.classList.remove('hidden');
    })
    .catch(err => {
      console.error(err);
      showError("⚠️ Fehler beim Abrufen der Daten.");
    });
}

// --- Кнопка поиска ---
searchBtnEl.addEventListener('click', getWeather);

// --- Нажатие Enter ---
cityInputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    getWeather();
  }
});

// --- Autocomplete via Geocoding API ---
let autocompleteAbortController = null;

cityInputEl.addEventListener('input', () => {
  const input = cityInputEl.value.trim();

  if (input.length < 2) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.add('hidden');
    return;
  }

  if (autocompleteAbortController) {
    autocompleteAbortController.abort();
  }
  autocompleteAbortController = new AbortController();
  const { signal } = autocompleteAbortController;

  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(input)}&limit=5&appid=${apiKey}`;

  fetch(geoUrl, { signal })
    .then(res => res.json())
    .then(data => {
      suggestionsEl.innerHTML = '';
      if (!Array.isArray(data) || data.length === 0) {
        suggestionsEl.classList.add('hidden');
        return;
      }

      data.forEach(place => {
        const cityName = place.name || '';
        const country  = place.country || '';
        const state    = place.state ? `, ${place.state}` : '';
        const label    = `${cityName}${state}, ${country}`;

        const div = document.createElement('div');
        div.textContent = label;
        div.addEventListener('click', () => {
          cityInputEl.value = cityName;
          suggestionsEl.innerHTML = '';
          suggestionsEl.classList.add('hidden');
          getWeather();
        });
        suggestionsEl.appendChild(div);
      });

      suggestionsEl.classList.remove('hidden');
    })
    .catch(err => {
      if (err.name === 'AbortError') return;
      console.error("Fehler beim Autovervollständigen:", err);
    });
});

// Клик вне поля — закрывает подсказки
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.add('hidden');
  }
});
