# scrape.py  (Revised)

import json
import time
import re
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

AZ_ARTIST_PAGE = "https://www.azlyrics.com/w/weeknd.html"

def fetch_page_html(url):
    """
    Launch a headless Chromium, navigate to `url`, wait for #listAlbum to be present,
    then return the fully rendered HTML.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/114.0.0.0 Safari/537.36"
            )
        )
        page.goto(url, timeout=30000)
        # Wait until the container that holds all song links (#listAlbum) appears
        page.wait_for_selector("div#listAlbum", timeout=15000)
        content = page.content()
        browser.close()
        return content

def get_song_links():
    """
    1) Fetch the fully rendered Weeknd artist page via Playwright.
    2) Parse out every <a href="../lyrics/weeknd/...">TITLE</a> from #listAlbum.
    """
    html = fetch_page_html(AZ_ARTIST_PAGE)
    soup = BeautifulSoup(html, "html.parser")

    container = soup.find("div", id="listAlbum")
    if not container:
        print("  [!] Could not find <div id='listAlbum'>—still blocked or wrong selector.")
        return []

    song_links = []
    # Now gather all <a> tags whose href matches "../lyrics/weeknd/*.html"
    for a in container.find_all("a", href=re.compile(r"^\.\./lyrics/weeknd/.*\.html$")):
        href  = a["href"]           # e.g. "../lyrics/weeknd/afterhours.html"
        title = a.text.strip()      # e.g. "After Hours"
        full  = "https://www.azlyrics.com/" + href.lstrip("../")
        song_links.append((title, full))
    return song_links

def scrape_lyrics_from_page(url):
    """
    Given a full AZLyrics song URL, fetch it via Playwright, then extract lyrics:
    - Find the two comment markers and grab the block between them.
    - Convert <br> to "\n", strip any remaining HTML tags.
    """
    html = fetch_page_html(url)
    # AZLyrics markers:
    start_marker = "<!-- Usage of azlyrics.com content"
    end_marker   = "<!-- MxM banner"
    if start_marker not in html or end_marker not in html:
        print(f"    [!] Markers not found in {url}")
        return None

    block = html.split(start_marker, 1)[1].split(end_marker, 1)[0]
    # Replace <br> with newline
    block = re.sub(r"<br\s*/?>", "\n", block, flags=re.IGNORECASE)
    # Remove any <div> wrappers
    block = re.sub(r"<div[^>]*>", "", block, flags=re.IGNORECASE)
    block = re.sub(r"</div>", "", block, flags=re.IGNORECASE)
    # Strip any leftover tags (e.g. <i>, <b>, etc.)
    block = re.sub(r"<[^>]+>", "", block)
    return block.strip() or None

def main():
    print("=> Fetching Weeknd song list (via headless Chromium)…")
    song_list = get_song_links()
    print(f"=> Found {len(song_list)} songs.\n")

    if not song_list:
        print("No songs found—check that #listAlbum appeared correctly.")
        return

    all_lyrics = {}
    for idx, (title, url) in enumerate(song_list, start=1):
        print(f"[{idx}/{len(song_list)}] Scraping \"{title}\" …", end=" ", flush=True)
        lyrics = scrape_lyrics_from_page(url)
        if lyrics:
            all_lyrics[title] = lyrics
            print("✓")
        else:
            print("✗ (skipped)")
        time.sleep(0.5)  # polite delay

    # Write out the JSON file
    with open("weeknd_lyrics.json", "w", encoding="utf-8") as f:
        json.dump(all_lyrics, f, ensure_ascii=False, indent=2)

    print(f"\n=> Done. Wrote {len(all_lyrics)} entries to weeknd_lyrics.json")

if __name__ == "__main__":
    main()
