import { JSDOM } from 'jsdom';

/** Tarayıcıdaki DOMParser'ın Node karşılığı. */
export const parseHtml = (html) => new JSDOM(html).window.document;
