---
title: FAQ
description: Frequently Asked Questions
icon: CircleHelp
---

## I don't want to open the player in a new tab [#shared-player]

When working with multiple notes with different media, you could find it annoying to keep open new players for each video. Media Extended solves this problem by integrating obsidian's native "pin tab" feature. Just right-click on the player tab and select "Pin". Now, this player will be shared across all notes and media, and you can easily switch between notes without being spammed with multiple players.

![pin player](./getting-started/pin-player.png)

## I want to open website from browser [#open-website]

You can use the following bookmarklet to open the current website in obsidian. Just create a new bookmark in your browser and paste the following code in the URL field.

```javascript copy
javascript: (() => {
  const o = document.querySelector("video, audio")?.currentTime;
  let e = window.location.href;
  o === null
    ? (e += "")
    : window.location.hash
    ? (e += `&t=${o}`)
    : (e += `#t=${o}`);
  window.open(`obsidian://mx-open?url=${encodeURIComponent(e)}`);
})();
```

Additionally, you can do this manually by appending the following part to the URL you want to open in obsidian in browser's address bar and hit enter:

```text copy
obsidian://mx-open/
```

## XXX website won't work in the player [#website-not-working]

If your website is officially supported by Media Extended, you can open an issue on the [GitHub repository](https://github.com/PKM-er/media-extended/issues/new), that includes: 

- YouTube
- Vimeo
- bilibili
- Coursera

If your website is not officially supported, you can first test in the browser for compatibility. If it works in the browser, but not in the player, you can request for support in GitHub discussions.

Before requesting new websites, first check if any website is already requested: [Website Requests](https://github.com/PKM-er/media-extended/discussions/categories/website). 
Add an upvote ⬆️ if you want the website to be supported.

For new website requests, go to [new request](https://github.com/PKM-er/media-extended/discussions/new?category=website). You should provide at least the followings: 
- example urls for pattern matching
- link to publicly available resource for testing

## I want "Link with pane" behavior to take timestamp/screenshot from non-media note [#restore-link-with-pane]

["Link with pane"](https://github.com/PKM-er/media-extended/wiki/Open-Links-in-One-Shared-Player) is a feature that has been refactored in v3. Now you can control the player with commands or your own assigned shortcuts on any active note, without having to associate the player with the note explicitly as before.

You may notice that the player is now marked as "active" with a red icon 🟥 in tab header. This indicates that the player is currently being used to take notes.

For more details about the media commands, please refer to [#Taking Notes](/getting-started/first-note#taking-notes)

## YouTube Video Auto Pausing in Webpage Player [#youtube-auto-pause]

This usually means that YouTube is asking for your consent to use cookies. You can fix this by open [youtube.com](https://youtube.com) in login browser using command "Login website"

In Media Extended v3.0.7, there should be a notice asking you to handle consent when you open a YouTube video. 

[Issue #219](https://github.com/PKM-er/media-extended/issues/219)