# WezFood

A personal recipe vault for Android. You add your own recipes, sort them into folders you make yourself, and find them again with combined filters (diet, dish type, utensils, ingredients; AND / OR).

## Status

Design exploration. `design/` holds three art directions, each applied to the three screens (Home, Folders, Create):

| | Direction | Leans on |
|---|---|---|
| A | **Marché** | neo-brutalism + bento: aubergine outlines, hard offset shadows, muted market colours |
| B | **Carnet** | editorial: oversized serif, magazine covers, skewed colour blocks |
| C | **Émail** | minimalism + progressive disclosure: enamelware white / navy rim / butter yellow |

```sh
pip install playwright==1.56.0 pillow
python design/render.py            # mockups/*.html -> exports/*.png (412x915 dp @2x)
python design/contact_sheet.py a- sheet.png
```

The 3D dishes are placeholders from Microsoft Fluent Emoji (MIT, see `design/assets/food/LICENSE-fluentui-emoji.txt`). In the app, the user's own photo gets the same cut-out look via on-device subject segmentation.

## Planned stack (subject to change)

- Kotlin + Jetpack Compose, Material 3 as the base layer, fully re-themed
- Room (SQLite), local-first, no account needed for v1
  - recipes, ingredients, utensils, tags and folders as tables with many-to-many joins, so AND / OR filters compile to plain SQL
  - FTS for free-text search over titles, ingredients and notes
- ML Kit Subject Segmentation to cut the dish out of the user's photo
- Coil for images, Navigation Compose for the three destinations
