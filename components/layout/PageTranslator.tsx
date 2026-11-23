"use client";

import { useEffect } from "react";

/**
 * Puts the page's fixed text into the business's language.
 *
 * The app's wording lives in several hundred components, as plain English in
 * the markup. Rather than rewrite each one to look its text up, this reads the
 * rendered page and swaps any piece of text that exactly matches a known
 * English phrase for its translation: buttons, headings, column titles,
 * statuses, field labels, placeholders. It watches for changes, so text that
 * appears later (a dialog, a new row, the next page) is translated too.
 *
 * What it deliberately leaves alone:
 *  - anything typed by a person, since only whole, exact phrases match;
 *  - form values, code, and anything inside [data-no-translate];
 *  - sentences it has no entry for, which stay in English.
 *
 * Text is changed in place, never wrapped or replaced, so React still owns
 * every node and updates them as usual.
 *
 * One rule matters more than the rest: a node is only touched once React has
 * taken it over. Pages arrive in pieces and each piece is checked against the
 * server's HTML as it wakes up; text changed before that check fails it, and
 * React throws the section away and renders it again. React marks every node
 * it has adopted, so that mark is the test, and the page is swept again a few
 * times after each change to catch the pieces that woke up in between.
 */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
const ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

export function PageTranslator({ locale }: { locale?: string | null }) {
  useEffect(() => {
    if (locale !== "sw" && locale !== "fr") return;
    let stopped = false;
    let observer: MutationObserver | null = null;
    let cleanup = () => {};

    void import("@/lib/i18n-pages").then(({ pageTextTable }) => {
      const table = pageTextTable(locale);
      if (!table || stopped) return;
      document.documentElement.lang = locale;

      // React keeps its bookkeeping on each DOM node under a "__reactFiber$…"
      // key, set when the node is created or hydrated.
      const adopted = (node: Node | null) => {
        if (!node) return false;
        for (const key in node) if (key.startsWith("__reactFiber$")) return true;
        return false;
      };

      const skip = (element: Element | null) =>
        !element || SKIP_TAGS.has(element.tagName) || element.closest("[data-no-translate],[contenteditable='true']") !== null;

      const translateText = (node: Text) => {
        const raw = node.nodeValue;
        if (!raw) return;
        const trimmed = raw.trim();
        if (trimmed.length < 2 || trimmed.length > 60) return;
        const translated = table[trimmed];
        if (!translated || skip(node.parentElement)) return;
        if (!adopted(node) && !adopted(node.parentElement)) return;
        node.nodeValue = raw.replace(trimmed, translated);
      };

      const translateAttributes = (element: Element) => {
        for (const name of ATTRIBUTES) {
          const value = element.getAttribute(name);
          if (!value) continue;
          const translated = table[value.trim()];
          if (translated && !skip(element) && adopted(element)) element.setAttribute(name, translated);
        }
      };

      const translateTree = (root: Node) => {
        if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        const element = root as Element;
        translateAttributes(element);
        for (const child of element.querySelectorAll("[placeholder],[title],[aria-label]")) translateAttributes(child);
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) translateText(node as Text);
      };

      // Sweep now and again shortly after, for sections React adopts later.
      let timers: number[] = [];
      const sweepSoon = () => {
        timers.forEach((id) => window.clearTimeout(id));
        timers = [150, 700, 2000, 5000].map((delay) => window.setTimeout(() => !stopped && translateTree(document.body), delay));
      };
      translateTree(document.body);
      sweepSoon();
      cleanup = () => timers.forEach((id) => window.clearTimeout(id));

      // A translated phrase has no entry of its own, so writing it back does
      // not trigger another pass: the observer settles after one round.
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") translateTree(mutation.target);
          else if (mutation.type === "attributes") translateAttributes(mutation.target as Element);
          else for (const added of mutation.addedNodes) translateTree(added);
        }
        if (mutations.some((mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0)) sweepSoon();
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRIBUTES],
      });
    });

    return () => {
      stopped = true;
      observer?.disconnect();
      cleanup();
    };
  }, [locale]);

  return null;
}
