# Redline Rush

A tiny 3D highway-dodging game that runs in the browser. Drive flat out down a two-way highway and weave through cars, trucks, vans, motorcycles and cyclists. Crash, and the whole wreck plays out in slow motion.

**Play:** https://andreasaugostocreator.github.io/redline-rush/

## Controls
| | Phone | Keyboard |
|---|---|---|
| Steer | Tilt the phone left/right | ← → or A / D |
| Nitro | Hold a finger on the screen | ↑ / W / Space |
| Brake | – | ↓ / S |

- Your phone's tilt when you press **DRIVE** counts as "straight", so hold it however you like.
- On iPhone, allow motion access when Safari asks.
- Driving in the **oncoming lanes** gives double points, and near misses give bonus points.
- Your speed keeps climbing the longer you survive (about 140 km/h at the start, up to about 370 km/h).

## Tech
Plain HTML and JavaScript with [three.js](https://threejs.org) loaded from a CDN. There is no build step, so `index.html` is served as-is by GitHub Pages.

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000. Tilt controls need HTTPS on real phones, so test on phones through the GitHub Pages link.
