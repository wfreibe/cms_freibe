-- 003_add_constraints_and_indexes.sql
-- Indexes for query optimization and constraint enforcement

CREATE INDEX IF NOT EXISTS idx_sections_lang_active_sort
    ON sections (lang, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_accordions_section_lang_sort
    ON section_accordions (section_id, lang, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
    ON login_attempts (ip, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time
    ON login_attempts (username, attempted_at);
