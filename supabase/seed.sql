insert into public.stores (code,name,tags,description,pure_veg,eta_min,color,sort) values
('HGS-001','Haneena''s General Store','General store · Snacks · Tea','Daily essentials, instant noodles, hot chai, sandwiches and late-night snacks. The campus lifeline, open till 1 AM.',false,5,'#F59E0B',1),
('SNC-002','Spices & Chefs','North Indian · Meals · Rolls','Fresh thalis, paneer rolls, biryani and chole bhature cooked to order in the main mess lane.',true,12,'#D9480F',2),
('AML-003','Amul','Dairy · Ice cream · Shakes','Cold coffee, lassi, buttermilk, kulfi and ice cream cones straight from the cold counter.',true,4,'#DC2F3A',3),
('MRS-004','Planet MARS','Cafe · Burgers · Pizza','Burgers, wood-fired style pizza, peri peri fries and wraps for the late study session.',false,15,'#6D44DC',4),
('GMC-005','GMC Store','Stationery · Essentials','Notebooks, pens, sticky notes, earphones and campus merchandise in one place.',false,3,'#1E6FD9',5),
('JUC-006','Juice Counter','Fresh juices · Shakes','Cold-pressed orange, watermelon, sugarcane and coconut water squeezed while you wait.',true,6,'#2E9E48',6);

insert into public.menu_items (store_id,name,description,price,veg,stock,sort)
select s.id, m.name, m.d, m.p, m.v, m.st, m.o from public.stores s join (values
('HGS-001','Masala Maggi','Hot, spicy, the 2-minute classic',30,true,40,1),
('HGS-001','Bun Maska + Chai','Soft bun, fresh butter, kadak chai',40,true,40,2),
('HGS-001','Veg Sandwich','Grilled with mint chutney',50,true,30,3),
('HGS-001','Cold Drink','300 ml, served chilled',20,true,4,4),
('HGS-001','Egg Roll','Street style with double egg',60,false,30,5),
('HGS-001','Biscuit Pack','Family pack, great with chai',10,true,60,6),
('SNC-002','Veg Thali','Dal, sabzi, rice, 3 rotis, salad',110,true,40,1),
('SNC-002','Paneer Roll','Tandoori paneer, onions, mint mayo',80,true,40,2),
('SNC-002','Veg Biryani','Dum biryani with raita',120,true,30,3),
('SNC-002','Chole Bhature','2 bhature with spicy chole',90,true,30,4),
('SNC-002','Masala Chaas','Spiced buttermilk, 250 ml',25,true,50,5),
('AML-003','Cold Coffee','Thick and chilled',60,true,40,1),
('AML-003','Mango Lassi','Sweet, 300 ml',50,true,40,2),
('AML-003','Buttermilk','Masala chaas, 200 ml',20,true,50,3),
('AML-003','Kulfi','Matka kulfi',45,true,30,4),
('AML-003','Ice Cream Cone','Vanilla or chocolate',40,true,50,5),
('MRS-004','Classic Burger','Veg patty, cheese, lettuce',90,true,30,1),
('MRS-004','Chicken Burger','Crispy chicken, house sauce',130,false,30,2),
('MRS-004','Margherita Pizza','8 inch, wood-fired style',180,true,20,3),
('MRS-004','Peri Peri Fries','Spicy, with dip',80,true,40,4),
('MRS-004','Chicken Wrap','Grilled chicken and slaw',110,false,30,5),
('GMC-005','Notebook A5','200 pages, ruled',60,true,50,1),
('GMC-005','Gel Pen (pack of 5)','Smooth blue ink',50,true,60,2),
('GMC-005','Sticky Notes','Neon, 100 sheets',40,true,50,3),
('GMC-005','Earphones','Wired, with mic',199,true,15,4),
('GMC-005','Campus Hoodie','Cotton fleece, unisex',799,true,10,5),
('JUC-006','Orange Juice','Cold-pressed, 300 ml',50,true,40,1),
('JUC-006','Watermelon Juice','Fresh, no sugar',40,true,40,2),
('JUC-006','Sugarcane Juice','With ginger and lemon',30,true,40,3),
('JUC-006','Coconut Water','Tender coconut',45,true,30,4)
) as m(code,name,d,p,v,st,o) on m.code = s.code;

-- demo logins: every store PIN is 1234, demo student password is looply123
insert into public.store_auth (store_id, pin_hash) select id, extensions.crypt('1234', extensions.gen_salt('bf')) from public.stores;

with s as (insert into public.students (student_code,name,campus,wallet,notes_count) values ('PGP2026-114','Durgesh','IIM Bangalore',450,3) returning id)
insert into public.student_auth (student_id, password_hash) select id, extensions.crypt('looply123', extensions.gen_salt('bf')) from s;
