INSERT INTO restaurantes (id,nombre_negocio,email,password_hash,suscripcion_activa,estado,slug) VALUES
('10000000-0000-4000-8000-000000000001','Prueba Uno','uno@example.invalid','synthetic',true,'aprobado','test-uno'),
('10000000-0000-4000-8000-000000000002','Prueba Dos','dos@example.invalid','synthetic',true,'aprobado','test-dos'),
('10000000-0000-4000-8000-000000000003','Prueba Vacia','vacia@example.invalid','synthetic',true,'aprobado','test-vacia');
INSERT INTO categorias_restaurante (id,restaurante_id,nombre) VALUES
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Categoria Sintetica'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Categoria Dos');
INSERT INTO platillos (id,restaurante_id,categoria_id,nombre,descripcion,precio,activo,ingredientes_principales,etiquetas_dieteticas,url_imagen) VALUES
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Taco sintetico','Catalogo uno',37.50,true,'["frijol"]','[]',NULL),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Sopa sintetica','Catalogo dos',52.00,true,'["maiz"]','[]',NULL),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',NULL,'Dato ausente',NULL,10.00,true,NULL,NULL,NULL),
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',NULL,'Inactivo',NULL,15.00,false,'[]','[]',NULL);
