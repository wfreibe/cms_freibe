ALTER TABLE sections ADD COLUMN image_layout TEXT NOT NULL DEFAULT 'original' CHECK(image_layout IN ('original','wide','left','right'));
