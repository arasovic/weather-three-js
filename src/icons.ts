// Hand-drawn icons from Koboyo (koboyo.com/icons), used under its licence; see icons/README.md.
const files = import.meta.glob<string>('./icons/*.svg', { query: '?raw', import: 'default', eager: true })

/** Inline SVG markup for one of the icons in ./icons, hidden from screen readers. */
export const icon = (name: string) =>
  files[`./icons/${name}.svg`].replace(/ aria-label="[^"]*"/, '').replace('<svg ', '<svg aria-hidden="true" ')
