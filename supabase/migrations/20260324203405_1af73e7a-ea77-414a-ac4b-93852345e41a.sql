-- Delete items in duplicate lists first
DELETE FROM market_items WHERE list_id IN ('b8abfa83-8aaa-400e-a582-49f1f7929c62', '45eb35f8-fbef-45b4-826d-ebc3db3a0158');
-- Delete duplicate family lists (keep the original db16afca)
DELETE FROM market_lists WHERE id IN ('b8abfa83-8aaa-400e-a582-49f1f7929c62', '45eb35f8-fbef-45b4-826d-ebc3db3a0158');