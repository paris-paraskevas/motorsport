# Car model attribution

`car.glb` — a generic open-wheel ("F1") 3D model used in the onboard qualifying replay.

- **Source:** FetchCFD — https://fetchcfd.com/view-project/4314-f1-3d-model
- **Original file:** `file-1713027814199.glb` (glTF 2.0). Untextured; 28 flat-colour PBR materials (`Material.000–.027`), meshes `Object_0…`. No baked livery/textures → no third-party brand imagery.
- **Changes made (2026-10-07):** compressed and simplified with glTF-Transform 4 (`optimize --compress meshopt --simplify true --simplify-ratio 0.25 --simplify-error 0.001 --join true --palette false --instance false`): 2,890 KB → 319 KB, 73 parts → 12, 48,966 triangles → 40,558, the same dimensions (4.458 × 1.782 × 1.077). The shape is visually unchanged at the replay's scale.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/ (confirmed on the project page).
- **Author:** credited on the project page above (FetchCFD uploader). **TODO before public ship:** insert the exact uploader handle for a complete CC-BY credit.
- **Use in Paddock:** recoloured per team with neutral colours only — **no team trademarks, liveries, names, or logos** are applied. The on-page credit appears in the OpenF1 attribution footer on F1 session pages.
