-- Menu placement is shared by translations and does not rewrite section content.
CREATE TABLE page_navigation (
 section_id TEXT PRIMARY KEY,
 parent_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX page_navigation_parent ON page_navigation(parent_id);
INSERT INTO page_navigation(section_id,parent_id)
 SELECT DISTINCT id, CASE WHEN substr(id,1,8)='project-' THEN '@projects' ELSE '' END FROM sections;
