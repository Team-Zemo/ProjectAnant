import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Project Anant',
  description: 'Forensic Mule Account Detection, 2M Transaction Graph Analytics & Aegon C++26 Engine',
  base: process.env.BASE_PATH || '/ProjectAnant/',
  cleanUrls: true,
  lastUpdated: true,

  markdown: {
    math: true,
  },

  themeConfig: {
    siteTitle: 'Project Anant',
    logo: '/mp_police_watermark.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'Detection & Formulas', link: '/detection/scoring-model' },
      { text: 'Aegon C++26 Core', link: '/engine/aegon-framework' },
      { text: 'Legal AI', link: '/legal/case-diary' },
      { text: 'Benchmarks', link: '/benchmarks/' },
      { text: 'API', link: '/api/reference' },
    ],

    sidebar: [
      {
        text: 'Overview & Architecture',
        items: [
          { text: 'Executive Summary', link: '/guide/introduction' },
          { text: 'System Architecture', link: '/guide/architecture' },
          { text: 'Quick Start & Setup', link: '/guide/quick-start' },
        ],
      },
      {
        text: 'Mule Detection & Algorithms',
        items: [
          { text: '7-Signal Scoring Model', link: '/detection/scoring-model' },
          { text: 'Mule Layers & Victim Shield', link: '/detection/mule-layers' },
          { text: 'Syndicate & Graph Clustering', link: '/detection/syndicates' },
        ],
      },
      {
        text: 'High-Performance Engine',
        items: [
          { text: 'Anant Engine (DuckDB & SIMD)', link: '/engine/anant-engine' },
          { text: 'Aegon C++26 Web Framework', link: '/engine/aegon-framework' },
        ],
      },
      {
        text: 'Digital Forensics & Legal AI',
        items: [
          { text: 'Case Diary & Sec 91 Notices', link: '/legal/case-diary' },
        ],
      },
      {
        text: 'User Interface',
        items: [
          { text: 'Dashboard & Graph Studio', link: '/ui/dashboard' },
        ],
      },
      {
        text: 'Benchmarks & Evaluation',
        items: [
          { text: 'Performance Benchmarks', link: '/benchmarks/' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'REST & SSE Endpoints', link: '/api/reference' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Project Anant — VoidHacks 8.0 · Operation Abhedya-Chakra · MP Police Cyber Cell 1930',
      copyright: 'Copyright © 2026 Project Anant Team. Open-Source under MIT License.',
    },
  },
})
