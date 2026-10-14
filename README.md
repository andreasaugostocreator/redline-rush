# Redline Rush

A tiny 3D highway-dodging game that runs in the browser. Drive flat out down a two-way highway past farms, houses, billboards and wind turbines, and weave through cars, buses, trucks, vans, motorcycles and cyclists. Crash, and the whole wreck plays out in slow motion.

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
- **Collisions are physical.** Your car has a health bar, and every vehicle has a mass:
  - **Side contact:** lean into a car to shove it out of its lane. Light cars get pushed around, trucks and buses barely move and push *you* back. Gentle pushing is free, and only real sideways impacts cost health.
  - **Rear-ending:** under about 80 km/h of closing speed it's a bump. You lose speed, they get shoved forward, and a hard hit spins them out. At higher closing speed it's a full wreck. Trucks and buses wreck you at a lower closing speed (about 45 km/h).
  - **Head-on with oncoming traffic** is always a wreck, unless you only clip a corner, which costs a lot of health and spins the other car.
  - **Cyclists and motorcycles** get knocked down and you keep driving with a few scratches.
  - **Spun-out cars** slide to a stop and become obstacles. Traffic queues up behind them.
  - Health slowly recovers. At low health your engine smokes and then burns, and at zero the next hit wrecks you.
- After you let go of nitro, the car coasts back down slowly instead of losing the speed all at once.
- Your speed keeps climbing the longer you survive (about 140 km/h at the start, up to about 370 km/h).

## Tech
Plain HTML and JavaScript with [three.js](https://threejs.org) loaded from a CDN. There is no build step, so `index.html` is served as-is by GitHub Pages.

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000. Tilt controls need HTTPS on real phones, so test on phones through the GitHub Pages link.
