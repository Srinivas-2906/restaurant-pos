SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ItemUnitConversion','StockCommitment','GoodsReceipt','WastageEntry','ProductionOrder','InventoryAlert','StockCount','PurchaseInvoice')
ORDER BY 1;
