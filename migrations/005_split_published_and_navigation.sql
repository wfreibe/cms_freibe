-- 005_split_published_and_navigation.sql
-- Separation of publication status (is_published) and navigation visibility (show_in_navigation)

-- 1. Add new columns to sections
ALTER TABLE sections ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1));
ALTER TABLE sections ADD COLUMN show_in_navigation INTEGER NOT NULL DEFAULT 1 CHECK (show_in_navigation IN (0, 1));

-- 2. Add new column to section_accordions
ALTER TABLE section_accordions ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1));

-- 3. Migrate existing data
UPDATE sections SET is_published = is_active;
UPDATE sections SET show_in_navigation = CASE 
    WHEN id IN ('impressum', 'datenschutz') THEN 0 
    ELSE is_active 
END;

UPDATE section_accordions SET is_published = is_active;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_sections_lang_published_nav 
    ON sections (lang, is_published, show_in_navigation, sort_order);

CREATE INDEX IF NOT EXISTS idx_accordions_section_lang_published
    ON section_accordions (section_id, lang, is_published, sort_order);
