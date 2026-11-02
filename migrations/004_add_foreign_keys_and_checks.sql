-- 004_add_foreign_keys_and_checks.sql
-- Transactional table rebuild adding Foreign Keys (ON DELETE CASCADE) and CHECK constraints

PRAGMA foreign_keys = OFF;

-- 1. Create rebuilt sections table with CHECK constraints
CREATE TABLE sections_new (
    id TEXT NOT NULL,
    lang TEXT NOT NULL CHECK (lang IN ('de', 'en')),
    sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order >= 0),
    nav_label TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    bg_color TEXT,
    bg_image_url TEXT,
    contact_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, lang)
);

-- 2. Create rebuilt section_accordions table with Foreign Key and CHECK constraints
CREATE TABLE section_accordions_new (
    id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    lang TEXT NOT NULL CHECK (lang IN ('de', 'en')),
    sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order >= 0),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, lang),
    FOREIGN KEY (section_id, lang) REFERENCES sections_new (id, lang) ON DELETE CASCADE
);

-- 3. Copy data atomically
INSERT INTO sections_new (id, lang, sort_order, nav_label, title, subtitle, content, image_url, bg_color, bg_image_url, contact_info, is_active, created_at, updated_at)
SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, bg_color, bg_image_url, contact_info, is_active, created_at, updated_at
FROM sections;

-- Copy only accordions that have a corresponding parent section (satisfying the foreign key)
INSERT INTO section_accordions_new (id, section_id, lang, sort_order, title, content, is_active, created_at, updated_at)
SELECT a.id, a.section_id, a.lang, a.sort_order, a.title, a.content, a.is_active, a.created_at, a.updated_at
FROM section_accordions a
INNER JOIN sections_new s ON a.section_id = s.id AND a.lang = s.lang;

-- 4. Replace tables
DROP TABLE section_accordions;
DROP TABLE sections;

ALTER TABLE sections_new RENAME TO sections;
ALTER TABLE section_accordions_new RENAME TO section_accordions;

-- 5. Recreate query optimization indexes
CREATE INDEX IF NOT EXISTS idx_sections_lang_active_sort
    ON sections (lang, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_accordions_section_lang_sort
    ON section_accordions (section_id, lang, is_active, sort_order);

PRAGMA foreign_keys = ON;
