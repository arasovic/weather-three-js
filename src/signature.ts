export function addSignature() {
  const el = document.createElement('nav')
  el.className = 'signature'
  el.innerHTML =
    '<a href="https://arasmehmet.com">Aras Mehmet</a>' +
    '<a href="https://github.com/arasovic/weather-three-js">Source</a>'
  document.body.appendChild(el)
}
