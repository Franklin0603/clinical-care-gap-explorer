/**
 * The Learn area, as data: four modules, three videos and the illustrations
 * that go with them.
 *
 * Media is not invented. A video without a real file has no source, duration
 * or poster, and its card shows an honest "coming soon" state instead of a
 * fake player; all three videos now have their files. Every illustration
 * carries a description of what it shows - written as the brief for the
 * image - and an illustration without a file renders that
 * description until a file is supplied. Adding a file is a one-line change
 * here; no page needs to change.
 */

export type LearnModule = {
  slug: string;
  href: string;
  title: string;
  summary: string;
  /** The video that belongs with this module, if any. */
  video?: string;
};

export const LEARN_MODULES: LearnModule[] = [
  {
    slug: "diabetes",
    href: "/learn/diabetes",
    title: "Understanding Diabetes",
    summary: "Learn how glucose, insulin and A1c relate to diabetes.",
    video: "a1c",
  },
  {
    slug: "care-gaps",
    href: "/learn/care-gaps",
    title: "Understanding A1c Care Gaps",
    summary: "Learn what current, overdue and never-tested statuses mean in this application.",
    video: "care-gap",
  },
  {
    slug: "using-the-app",
    href: "/learn/using-the-app",
    title: "Using Care Gap Explorer",
    summary: "Learn how to move from population monitoring to patient follow-up.",
    video: "walkthrough",
  },
  {
    slug: "care-teams",
    href: "/learn/care-teams",
    title: "For Care Teams",
    summary: "Learn how the application's evidence, analytics and workflow can support review.",
  },
];

export const moduleBySlug = (slug: string) => LEARN_MODULES.find((m) => m.slug === slug);

export type LearnVideo = {
  id: string;
  title: string;
  description: string;
  /** Path under public/, without the base path. Never a placeholder URL. */
  src: string | null;
  /** Length as shown, read from the file ("0:53"). */
  duration: string | null;
  /** Poster image under public/. */
  poster: string | null;
  /** WebVTT captions under public/, if any. */
  captions: string | null;
};

/** The three videos, produced to match the modules. 1920x1080 H.264/AAC,
 *  with English captions. */
export const VIDEOS: LearnVideo[] = [
  {
    id: "a1c",
    title: "Understanding A1C",
    description: "See how glucose, insulin, red blood cells, and hemoglobin connect to the A1C blood test.",
    src: "/videos/understanding-a1c.mp4",
    duration: "0:53",
    poster: "/img/video-posters/understanding-a1c.webp",
    captions: "/videos/understanding-a1c.vtt",
  },
  {
    id: "care-gap",
    title: "Understanding an A1C Care Gap",
    description: "See how Care Gap Explorer uses a 365-day monitoring window to classify patients as current, overdue, or never tested.",
    src: "/videos/understanding-a1c-care-gap.mp4",
    duration: "1:01",
    poster: "/img/video-posters/understanding-a1c-care-gap.webp",
    captions: "/videos/understanding-a1c-care-gap.vtt",
  },
  {
    id: "walkthrough",
    title: "Using Care Gap Explorer",
    description: "Take a guided tour from population monitoring to patient review, workflow tracking, analytics, and Ask AI.",
    src: "/videos/using-care-gap-explorer.mp4",
    duration: "1:22",
    poster: "/img/video-posters/using-care-gap-explorer.webp",
    captions: "/videos/using-care-gap-explorer.vtt",
  },
];

export const videoById = (id: string) => VIDEOS.find((v) => v.id === id);

export type Illustration = {
  id: string;
  /** What the image shows, for a screen reader. */
  alt: string;
  /** The visible caption: what to notice. Falls back to the alt text. */
  caption?: string;
  /** What the image should show: the brief for whoever makes it. */
  brief: string;
  ratio: "16/9" | "4/3" | "1/1" | "21/9";
  /** Path under public/, without the base path. */
  src: string | null;
  /** The file's pixel size, so the page does not jump as it loads. */
  size?: { width: number; height: number };
};

export const ILLUSTRATIONS: Record<string, Illustration> = {
  food: {
    id: "food",
    alt: "Bread, rice and an apple, with an arrow to glucose molecules",
    caption: "Carbohydrates in food, such as bread, rice and fruit, are broken down into glucose.",
    brief: "Everyday carbohydrate foods on one side, glucose molecules on the other.",
    ratio: "4/3", src: "/img/learn/food-to-glucose.webp", size: { width: 1168, height: 872 },
  },
  bloodstream: {
    id: "bloodstream",
    alt: "A cut-away blood vessel with red blood cells and glucose molecules flowing through it",
    caption: "Glucose travels in the blood alongside red blood cells, to the cells that need it.",
    brief: "Glucose molecules travelling through a blood vessel after a meal, among red blood cells. Calm, clinical, labelled.",
    ratio: "4/3", src: "/img/learn/bloodstream.webp", size: { width: 1168, height: 880 },
  },
  insulin: {
    id: "insulin",
    alt: "Two panels: insulin approaching a receptor on a cell surface, then the receptor open and glucose moving into the cell",
    caption: "Before: glucose waits outside the cell. After: insulin binds to its receptor and glucose moves in.",
    brief: "Insulin binding to a cell and glucose moving from the blood into the cell, shown as a simple before-and-after.",
    ratio: "4/3", src: "/img/learn/insulin.webp", size: { width: 1168, height: 880 },
  },
  "red-cells": {
    id: "red-cells",
    alt: "Red blood cells along a timeline, collecting more glucose on their haemoglobin, with one cell magnified",
    caption: "Over a red cell's life, about 120 days, more glucose attaches to its haemoglobin. A1c measures that share.",
    brief: "Red blood cells with glucose attached to the haemoglobin inside them, with a note that a red cell lives about 120 days.",
    ratio: "4/3", src: "/img/learn/red-cells.webp", size: { width: 1168, height: 880 },
  },
  workflow: {
    id: "workflow",
    alt: "The care-gap workflow, from detection to follow-up",
    brief: "Six connected steps: identify a gap, review the evidence, inspect history, record follow-up, monitor completion, review analytics.",
    ratio: "21/9", src: null,
  },
};
