# KOREA Kraoke songbook 🎤 (v1.1.0)

[한국어 README](README.md)


A **PWA for saving karaoke song numbers**, designed to be added to your iPhone home screen.

## Key Features

- **POP / J-POP / Ballad (`발라드`)** genre filters for organizing saved songs into categories
- A genre picker when saving a song from the full-catalog search results
- Genre selection when manually adding or editing songs, with song counts for each category
- Songs labeled `팝송` in older backups automatically appear in the **POP** category
- **Category definitions:** POP = international pop, J-POP = Japanese songs, Ballad (`발라드`) = ballads. All remaining genres appear under Other (`기타`), including K-POP and rock.

- Online TJ / KY (Kumyoung) search by song title, artist, or song number
- Save song numbers from search results to your personal songbook and mark songs as favorites
- Store TJ and KY numbers separately for each song
- Record your preferred key, genre, notes, and alternative spellings such as Japanese readings
- Search saved songs using the alternative spellings you have entered (automatic Japanese transliteration is not supported by the external API)
- View and edit saved songs offline
- Export and import JSON backups, which you can save to iCloud Drive or another location
- iPhone Safari home screen icon and a dark theme

## Getting Started — Deploying to the Web

**Recommended hosting: Vercel (you can start with a free plan; check the terms of use)**

1. Create a new repository on GitHub and upload **the files in this folder as they are**. Keep the `public` and `api` folders at the same top level.
2. Sign in at https://vercel.com/ → **Add New > Project** → connect your GitHub repository.
3. Set Framework Preset to **Other** and Root Directory to the project root (`.`). No separate build command is required. Deploy the static files in `public` and the serverless function in `api/search.js`. If the platform asks for an output directory, set it to `public`.
4. Click **Deploy** to get a URL in the form `https://...vercel.app`.
5. Open that URL in **Safari** on your iPhone, then tap Share → **Add to Home Screen** → **Open as Web App** (if available) → Add.
6. Open the app and test the search by entering a song title such as `신호등`.

**Why Vercel?** `api/search.js` relays external API searches through the same origin to avoid Safari's CORS restrictions. Saving songs and the PWA features can also work on a static host such as GitHub Pages, but full-catalog search may fail depending on the external API's CORS permissions. Vercel is therefore recommended for reliable search functionality.

### Verifying the Installation

- Open your Vercel URL in Safari on your iPhone and select **Add to Home Screen**.
- Tap the **Songbook (`노래책`)** icon on the home screen to launch the app.
- Switch between `TJ` and **Kumyoung (`금영`)**, search for a song on each, and confirm that song numbers appear.
- Save a song you like, then enable **Airplane Mode** and confirm that its saved number is still visible.
- In Settings (`설정`), tap **Save songbook backup file (`노래책 백업 파일 저장`)** and save it to iCloud Drive.

### Previewing Locally

Opening `public/index.html` directly as a file may limit storage and PWA functionality. With Node.js 18 or later, run `npm run dev`, then open `http://localhost:4173`. The development server needs a network connection that can reach the external API.

## Data Storage

Saved songs are stored in **IndexedDB** in the browser on each device. The app does not create a server-side account or upload your songbook data. Search terms, however, are sent to the external search service. There is no automatic synchronization between devices, and clearing Safari data may delete your songbook. In the app, go to Settings (`설정`) → **Save songbook backup file (`노래책 백업 파일 저장`)** to download a JSON backup and save it to iCloud Drive. On a new device, use **Import backup file (`백업 파일 가져오기`)**.

## External Search Limitations

Full-catalog search uses the third-party public service API Manana (`https://api.manana.kr/v2/karaoke/search.json`). **This is not an official TJ or Kumyoung API.** Service policies, availability, CORS behavior, data accuracy, and freshness may change. Double-check important song numbers using the official karaoke catalog searches.

- Official TJ search: https://www.tjmedia.com/song/accompaniment
- Kumyoung search: https://kysing.kr/search/

The external search API does not provide genres, so **search results are not automatically categorized by genre**. Choose POP / J-POP / Ballad (`발라드`) yourself when saving a song.

If the API fails, the app displays an error and provides links to the official searches. It does not display invented song numbers or fabricate search results.

## File Structure

- `public/index.html`: app interface
- `public/styles.css`: styling and mobile layout
- `public/app.js`: search, song registration, favorites, IndexedDB, and JSON backup/restore
- `public/sw.js`: offline PWA cache
- `public/manifest.webmanifest`: home screen app configuration
- `public/icons/`: home screen icons
- `api/search.js`: Vercel serverless API relay
- `dev-server.js`: local test server using only built-in Node.js modules

## Updating After Development

When deploying changes to the UI or scripts, change the `CACHE` value in `public/sw.js` to a new version to refresh the cache. Your songbook data remains in IndexedDB.

## Automated Tests

With Node.js 18 or later, run `npm test` to test the static PWA file configuration and the server's search request and error handling. The current automated tests **do not call the external search service directly** and do not replace testing on a physical iPhone.

## Data Usage Considerations

The search API uses song number data supplied by a third-party service. Even for personal use, check the third-party API's license, request limits, and service policies, and verify the final song numbers on an actual karaoke machine.
