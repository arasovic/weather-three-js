export function addSignature() {
  const el = document.createElement('nav')
  el.className = 'signature'
  el.innerHTML =
    '<a href="https://arasmehmet.com">Aras Mehmet</a>' +
    '<a href="https://github.com/arasovic/weather-three-js">Source</a>' +
    '<a href="https://open-meteo.com" title="Weather data by Open-Meteo">Open-Meteo</a>'
  document.body.appendChild(el)
}
