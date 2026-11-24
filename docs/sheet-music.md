# Sheet music

The app keeps a local shelf of the music a student brings: a PDF from a
teacher, photos of a part, a MusicXML file. **Nothing is uploaded and no scores
ship with the app**, so the repository carries code only and every piece belongs
to whoever put it on that device.

No score ships at all: the shelf starts empty and holds only what the student
adds. The repository carries code.

The shelf is IndexedDB. Leaving the section or closing the tab does not lose a
piece; clearing the site's data does.

## Using it

* **Add music** takes PDFs, images and MusicXML. A file named `Gavotte - Gossec.pdf`
  becomes the title *Gavotte* by *Gossec*.
* Tap a page's right or left third to turn — or swipe, or the arrows, or a
  keyboard's arrow and Page keys. The settings panel can make that a half-page
  turn, which is the gesture for a phone on a stand.
* Zoom with pinch or `Ctrl`+wheel, or the zoom buttons. Fit is a setting, not a
  one-off: *whole page* or *width*.
* **Page tone** offers paper, sepia and night; night inverts and softens the
  page, which is the difference between a bright page and a usable one in a dark
  room. Brightness and the four crop edges sit beside it.
* **Bookmarks** hold a page and a name; the last page read opens next time.
* The pen, highlighter and box eraser write **on the page**, saved per page. A
  stroke is kept in page-relative coordinates, so zooming, cropping and the next
  visit put it back where it was.
* **Practice track** attaches audio to the piece: play, seek, volume, an A–B
  loop, and a click track. Speed (0.5–1.5×) keeps the pitch and pitch (±12
  semitones, semitone steps) keeps the speed. Tracks can start with the page.

## Scanning a page

**Scan** on the shelf (or *Scan pages* under an image piece) opens the camera and
finds the sheet. A ring around the shutter fills while it holds; at the top it
takes the picture. **Shooting and correcting are separate:** the frame is kept as
taken, then a thumbnail opens an editor where the corners are dragged onto the
page and the look is chosen — Clean (flattened light) by default, then document
colour, original, grey, black and white. Pages stack and are saved as one piece
when finished.

Studied in Scanner Pro 9.0.5 (`ScannerPro.app`, Mach-O + `ScannerPro/…` Swift
paths), and what was reproduced:

| Scanner Pro | Here |
| --- | --- |
| `DocumentBordersDetector`, `HoughBordersDetector`, `AdaptiveQuadDetector`, `StillImageQuadDetector`, with `OneEuroQuadrilateralFilter` / `ExtendedKalmanFilter` steadying the quad | Otsu bright-region and Sobel-edge candidates in `src/scan.js`, a smoothed average over frames |
| `SPAutoCaptureManager`, `ShutterState`, "Hold still to take picture" | stillness test over seven samples, shutter fires after a cool-down |
| `SPAutoCaptureManagerConfig`, `CapturePerspectiveAnalyzer`, manual mode "tap anywhere to adjust corners" | corner handles and an auto on/off switch |
| `SPQuadWrapStepOperation` (homography) | `homography()` + bilinear `warpPixels()` |
| `ShadowRemovalFilter`, `ColorDocumentFilter`, `BlackWhiteFilter`, `DenoiseFilter`, `UnsharpMaskFilter`, `ColorModeClassifier` "Smart Filters" | colour balance, shadow-flattening "clean", grey and adaptive B&W in `applyFilter()` |
| `OneVsTwoPageClassifier`, `SPCaptureBookBorderView` (book mode) | one page per frame; no spread split |
| `FingersSegmentationModule` + `InpaintingFilter` (LaMa/GPU) | not ported — a thumb in the corner stays |
| `DocumentPlanarizer` sits on Leptonica `dewarpa` (text-line disparity); applicability/quality analysers decide when to run | `src/dewarp.js` tracks long staff or text lines, builds a vertical disparity field and straightens; a per-page switch, off when no long lines are found |
| `FlounderArtifactClassificator` (16 KB Core ML model) guards the planarizer | not ported; line count and bow are the only guards |
| MLKit / Apple Vision / Tesseract OCR, `SPOCRProcessingService` | not in the scan screen; *Listen* still takes MusicXML |
| `spdoc` package, multi-page counter, retake, reorder, PDF/JPEG/TXT export, password | image piece pages, remove-last, saved as JPEG pages; PDFs are made outside the app |

The screen is `src/scanview.js`; the arithmetic is `src/scan.js` and is covered
by `tests/scan.test.html` (`tests/sheet-scan.test.html` drives the camera with
Chrome's fake device).
## Dropbox

**Cloud** on the shelf browses Dropbox and downloads a piece or an audio track
into the local shelf. Files are copied to the device; the app still works with
Dropbox closed afterwards.

The page is static, so the sign-in uses Dropbox's own recommendation for that
case: OAuth with PKCE, read-only scopes (`files.metadata.read`,
`files.content.read`), no client secret. One Dropbox app has to exist, and its
key is public and typed into the app once:

1. Open the [App Console](https://www.dropbox.com/developers/apps), create an app,
   choose **Scoped access** and **Full Dropbox**.
2. On **Permissions**, tick `files.metadata.read` and `files.content.read`, then
   Submit. In **Settings**, turn on **Allow public clients**.
3. Copy the address the setup panel shows into **Redirect URIs** (it is this page
   without a query — `http://localhost:8777/` while testing, the published
   address in use otherwise), then paste the app key into the app.

The refresh token stays in that browser; **Sign out** removes it. While Dropbox
is reviewing the app, up to 500 accounts can connect — enough for a studio.

## Bluetooth page turners

Pair the pedal with the tablet **as a keyboard** and it works: the app listens at
the document for key presses, wherever the focus is. AirTurn, PageFlip and most
footswitches send PageUp/PageDown or the arrows out of the box; B and N are also
mapped, and any key can be reassigned under **Page settings → Page turner** by
pressing the pedal switch when asked.

AirTurn's "direct mode" is a BLE GATT link, which a web page cannot open — pair
in the normal OS keyboard way instead (that is what the pedal's keyboard mode
is). The reader flashes the key it heard next to the page number, which makes a
mis-paired pedal obvious in one press.
## What this borrows from MobileSheets, and what it does not

Studied: MobileSheets Pro 3.9.45 (Build 650), package
`com.zubersoft.mobilesheetsfree`. No code or art was copied; the notes below are
what the app's own classes and strings do.

| MobileSheets | Here |
| --- | --- |
| Native PDF engine `librddoc.so` (Radaee PDF SDK) behind `PdfRenderLibrary.jniRenderBitmap`, night mode as a render flag | Mozilla pdf.js renders the page to a canvas; tone is a CSS filter |
| `MsgAudioPlayer`/`PlayerWrapper` with `setTempo`/`setPitchShift` over `libMsAudioPlayer.so` (Superpowered), A–B `loopBetween`, fades, balance, mono | Web Audio `AudioBufferSourceNode` plus a granular stretch in `src/tempoaudio.js`; A–B loop, fades from the gain |
| Camera scan with auto-crop (Genius Scan SDK), PDF from photos, image correction | Pick photos or a PDF; browser image decode; crop edges in the reader |
| Import from device, SAF, Dropbox, Drive, OneDrive, Nextcloud; batch import | Pick from the device; any cloud the device's file picker exposes |
| Tap zones, swipe, half-page, two pages, pedal/MIDI turns, auto-scroll | Tap zones, swipe, half-page, two pages, arrows; pedal and MIDI are not wired |
| Ink and highlighter with layers, stamps and text, written into the PDF on export | One ink layer per page, pen/highlighter/eraser, kept in the database |
| PDF passwords, PDF links and bookmarks | PDF bookmarks are not read; page bookmarks are |

## Files

* `src/sheetlib.js` — the shelf: records, files, ink and track storage, and the
  arithmetic a page needs (fit, crop, page limits, semitone ratio).
* `src/sheetview.js` — the shelf screen and the reader.
* `src/tempoaudio.js` — the stretch behind speed and pitch.
* `vendor/pdfjs/` — pdf.js (Apache-2.0, licence alongside), pinned to
  `pdfjs-dist@6.5.438`, legacy build. Fetched only when a PDF is opened and
  cached on the device like the recorded violin.

## Limits worth saying out loud

Speed and pitch are granular, not studio quality: at the extremes the bowing
smears. Pitch-preserving playback of an audio element (`preservesPitch`) is not
used because it cannot change key at a fixed tempo. Password-protected PDFs open
if pdf.js can read them, and say so if not. A scanned PDF is an image to this
app — the note-following in *Listen* still wants MusicXML.

Straightening corrects vertical bowing only, and only where long lines are
visible; a page squeezed sideways by a gutter keeps that squeeze. Finger removal
and OCR are still out of reach here.
