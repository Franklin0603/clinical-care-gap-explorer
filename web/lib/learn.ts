/**
 * The Learn area, as data: four modules, three videos and the illustration
 * slots that will hold them.
 *
 * Media is not invented. Every video has no source, no duration and no poster
 * until a real file exists, and the pages show an honest "coming soon" state
 * instead of a fake player. Every illustration slot carries a description of
 * what it will show - written as the brief for the image - and renders that
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
  /** Set when the file exists. Never a placeholder URL. */
  src: string | null;
  /** "4:30", once known. */
  duration: string | null;
  /** Thumbnail image, once one exists. */
  poster: string | null;
};

export const VIDEOS: LearnVideo[] = [
  {
    id: "a1c",
    title: "Understanding A1c",
    description: "What the A1c test measures, why it reflects about three months of glucose, and what it cannot tell you.",
    src: null, duration: null, poster: null,
  },
  {
    id: "care-gap",
    title: "Understanding an A1c Care Gap",
    description: "How the application decides that a patient is current, overdue or never tested, using a 365-day lookback.",
    src: null, duration: null, poster: null,
  },
  {
    id: "walkthrough",
    title: "Using Care Gap Explorer",
    description: "A tour from the Home dashboard to a patient's record, a follow-up task, Analytics and Ask AI.",
    src: null, duration: null, poster: null,
  },
];

export const videoById = (id: string) => VIDEOS.find((v) => v.id === id);

export type Illustration = {
  id: string;
  /** Alt text once the image exists; also the visible caption. */
  alt: string;
  /** What the image should show: the brief for whoever makes it. */
  brief: string;
  ratio: "16/9" | "4/3" | "1/1" | "21/9";
  src: string | null;
};

export const ILLUSTRATIONS: Record<string, Illustration> = {
  bloodstream: {
    id: "bloodstream",
    alt: "Glucose carried in the bloodstream",
    brief: "Glucose molecules travelling through a blood vessel after a meal, among red blood cells. Calm, clinical, labelled.",
    ratio: "4/3", src: null,
  },
  insulin: {
    id: "insulin",
    alt: "Insulin helping glucose enter a cell",
    brief: "Insulin binding to a cell and glucose moving from the blood into the cell, shown as a simple before-and-after.",
    ratio: "4/3", src: null,
  },
  "red-cells": {
    id: "red-cells",
    alt: "Glucose attached to haemoglobin in red blood cells",
    brief: "Red blood cells with glucose attached to the haemoglobin inside them, with a note that a red cell lives about 120 days.",
    ratio: "4/3", src: null,
  },
  workflow: {
    id: "workflow",
    alt: "The care-gap workflow, from detection to follow-up",
    brief: "Six connected steps: identify a gap, review the evidence, inspect history, record follow-up, monitor completion, review analytics.",
    ratio: "21/9", src: null,
  },
};
