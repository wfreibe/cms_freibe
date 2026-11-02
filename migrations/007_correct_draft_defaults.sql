-- Correct draft defaults even on installations with the original version 005.
PRAGMA foreign_keys = OFF;

-- 1. Create rebuilt sections table with CHECK constraints
CREATE TABLE sections_corrected (
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
    is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    show_in_navigation INTEGER NOT NULL DEFAULT 1 CHECK (show_in_navigation IN (0, 1)),
    PRIMARY KEY (id, lang)
);

-- 2. Create rebuilt section_accordions table with Foreign Key and CHECK constraints
CREATE TABLE section_accordions_corrected (
    id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    lang TEXT NOT NULL CHECK (lang IN ('de', 'en')),
    sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order >= 0),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, lang),
    FOREIGN KEY (section_id, lang) REFERENCES sections_corrected (id, lang) ON DELETE CASCADE
);

-- 3. Copy data atomically
INSERT INTO sections_corrected (id, lang, sort_order, nav_label, title, subtitle, content, image_url, bg_color, bg_image_url, contact_info, is_active, created_at, updated_at, is_published, show_in_navigation)
SELECT id, lang, sort_order, nav_label, title, subtitle, content, image_url, bg_color, bg_image_url, contact_info, is_active, created_at, updated_at, is_published, show_in_navigation
FROM sections;

-- Copy only accordions that have a corresponding parent section (satisfying the foreign key)
INSERT INTO section_accordions_corrected (id, section_id, lang, sort_order, title, content, is_active, created_at, updated_at, is_published)
SELECT a.id, a.section_id, a.lang, a.sort_order, a.title, a.content, a.is_active, a.created_at, a.updated_at, a.is_published
FROM section_accordions a
INNER JOIN sections_corrected s ON a.section_id = s.id AND a.lang = s.lang;

-- 4. Replace tables
DROP TABLE section_accordions;
DROP TABLE sections;

ALTER TABLE sections_corrected RENAME TO sections;
ALTER TABLE section_accordions_corrected RENAME TO section_accordions;

-- 5. Recreate query optimization indexes
CREATE INDEX IF NOT EXISTS idx_sections_lang_active_sort
    ON sections (lang, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_accordions_section_lang_sort
    ON section_accordions (section_id, lang, is_active, sort_order);

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_sections_lang_published_nav ON sections(lang,is_published,show_in_navigation,sort_order);
CREATE INDEX IF NOT EXISTS idx_accordions_section_lang_published ON section_accordions(section_id,lang,is_published,sort_order);
