# Weather Three.js

An interactive weather explorer that blends real-time forecasts with a fully navigable 3D Earth built on React Three Fiber. Search for any location, watch the globe rotate into view, and get weather insights presented through a clean, responsive UI that feels at home on desktop, tablet, and mobile.

> **Live:** [weather.arasmehmet.com](https://weather.arasmehmet.com)

## Features
- High-resolution NASA Blue Marble texture rendered with Three.js and React Three Fiber
- Smooth camera transitions that lock onto searched locations while the globe keeps rotating
- Location history and favorites with quick-access panels tailored for touch and desktop layouts
- Weather overlays with particle effects for rain, snow, and thunderstorms
- Responsive design that shifts to compact controls and bottom sheets on smaller screens

## Getting Started
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Launch the development server:
   ```bash
   pnpm dev
   ```
3. Visit `http://localhost:5173` in your browser and start searching for locations.

### Available Scripts
- `pnpm dev` — start Vite in development mode
- `pnpm build` — create a production build
- `pnpm preview` — preview the production build locally
- `pnpm lint` — run ESLint across the project

## Project Structure
```text
public/
  textures/            # Earth imagery assets (NASA Blue Marble)
src/
  components/          # Globe, weather UI, particles, and scene orchestration
  hooks/               # Weather and geolocation hooks
  services/            # API clients for weather and geocoding
  types/               # Shared TypeScript definitions
  utils/               # Coordinate math and helpers
```

## Data Sources & Credits
- **Earth imagery:** NASA Blue Marble Next Generation — Land Surface, Ocean Color and Sea Ice
- **Weather data:** Provided by the configured weather API in `src/services/weatherAPI.ts`
- **Geocoding:** Provided by the configured geocoding API in `src/services/geocodingAPI.ts`

## Contributing
Issues and pull requests are welcome. If you plan to work on a larger feature, please open an issue first so we can discuss the approach.

## License
This project is released under the MIT License.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
