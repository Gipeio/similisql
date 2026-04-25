# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**similisql** is a local webapp to visualize and edit plain-text relational tables, intended to be queried by an AI later.

## Stack

Vite + React + TypeScript + Tailwind v4 + shadcn/ui. No backend — all state lives in `localStorage`.

## Dev

```bash
make dev   # starts Vite with --host on port 5173
```

## File format (.ssql.txt)

Files use the `.ssql.txt` double extension — opens in a text editor on double-click while remaining identifiable.

**Line 1 — header:** pipe-separated column definitions.

```
name:type|name:type|name:type:fk:othertable.column
```

Supported types: `string`, `int`, `float`, `bool`, `date`.

Foreign key syntax appended to the column definition: `:fk:table.column`.

**Lines 2+ — data rows:** pipe-separated values, one per column. Empty values are allowed (written as empty string between pipes).

**File states detected on load:**
- Empty file → init mode
- Valid format → load and display
- Invalid format → error with reason

**Example:**

```
id:int|game_id:int:fk:games.id|name:string|grade:int
1|1|Resto Druid|8
2|1|Balance Druid|
```

## Architecture

```
src/lib/
  types.ts     — Column, Table, ParseResult types
  parser.ts    — parseFile() and serializeTable()
  storage.ts   — localStorage read/write and file export

src/components/
  FileDropZone.tsx         — drag & drop or file picker
  TableView.tsx            — renders the table with typed column badges
  AddRowModal.tsx          — popup form with per-type validation
  OverwriteWarningModal.tsx — shown when loading a file while one is already open
```

`App.tsx` owns all state and wires the components together.