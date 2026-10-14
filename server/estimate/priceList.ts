/**
 * Level price list and Egor's estimate rules (source: the smeta-level skill, reference
 * estimate Кузнечная 84). Prices are for work only, in rubles.
 *
 * The model only returns quantities for these ids; names, units, prices and section order
 * always come from here, so a price can never be invented by the model.
 */

export type SectionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const SECTIONS: Record<SectionId, string> = {
  1: "Демонтажные работы",
  2: "Электромонтажные работы",
  3: "Стены",
  4: "Полы",
  5: "Потолок",
  6: "Плиточные работы",
  7: "Сантехнические работы",
  8: "Откосы",
  9: "Прочие работы",
};

export type PriceItem = {
  id: string;
  section: SectionId;
  name: string;
  unit: string;
  /** null — priced under a separate contract (stretch ceiling): the row shows the area, sum 0. */
  price: number | null;
  note?: string;
  /** Shown even with no quantity, price only: options the client may add. */
  optional?: boolean;
  /** Used only when the model says the project needs it; never added by default. */
  hint: string;
};

const I = (id: string, section: SectionId, name: string, unit: string, price: number | null, hint: string, extra: Partial<PriceItem> = {}): PriceItem =>
  ({ id, section, name, unit, price, hint, ...extra });

export const PRICE_LIST: PriceItem[] = [
  // 1. Демонтаж
  I("dem_panel", 1, "Демонтаж электрощита", "шт.", 1_810, "existing electrical panel replaced"),
  I("dem_markup", 1, "Демонтаж разметки перегородок", "компл.", 6_000, "1 if existing partitions are only markup / first rows (h≈300 mm)"),
  I("dem_partitions", 1, "Демонтаж перегородок", "м2", 700, "m2 of full-height partitions to demolish"),

  // 2. Электромонтаж
  I("el_panel", 2, "Монтаж электрощита от 37 до 53 модулей", "шт.", 7_950, "new panel, usually 1"),
  I("el_breaker", 2, "Установка автоматического выключателя", "шт.", 1_300, "breakers per panel schedule", { note: "по факту" }),
  I("el_rcd", 2, "Установка ВН, УЗО, Диф.Автомата", "шт.", 1_600, "RCD/RCBO/main switch per panel schedule", { note: "по факту" }),
  I("el_passthrough", 2, "Установка проходного выключателя", "шт.", 1_200, "two-way (проходные) switches"),
  I("el_socket", 2, "Установка розетки, выключателя", "шт.", 950, "all sockets + ordinary switches"),
  I("el_box", 2, "Штробление гнезда под выключатель, розетку + уст. подрозетника", "шт.", 1_250, "= all sockets + all switches", { note: "по факту" }),
  I("el_chase", 2, "Штробление канала для проводки кабеля до 20 мм (+50% свыше)", "м/п", 950, "≈40 m for a 55–70 m² flat, scale by area", { note: "по факту" }),
  I("el_cable", 2, "Прокладка кабеля", "м/п", 340, "≈400 m for a 55–70 m² flat, scale by area", { note: "по факту" }),
  I("el_chase_fill", 2, "Заделка штробы до 20 мм (+100% за каждые доп. 50 мм)", "м/п", 200, "same as chase length", { note: "по факту" }),
  I("el_floor_heat", 2, "Устройство тёплых полов из нагревательных матов", "шт.", 6_600, "number of heated-floor zones/mats (pieces, not m²)"),
  I("el_floor_thermostat", 2, "Установка регулятора электрического тёплого пола", "шт.", 2_986, "one per heated zone"),

  // 3. Стены
  I("w_aerated", 3, "Кладка перегородок из газобетона", "м2", 1_800, "new partitions (default material) m2 = length × height − openings"),
  I("w_gkl_partition", 3, "Устройство перегородок из ГКЛ (каркас и обшивка 2 слоя)", "м2", 4_200, "ONLY if the project explicitly says plasterboard partitions"),
  I("w_gkl_lining", 3, "Облицовка стен ГКЛ по каркасу", "м2", 2_800, "plasterboard wall lining"),
  I("w_gkl_joints", 3, "Заделка стыков, шурупов на ГКЛ", "м2", 440, "= plasterboard walls area"),
  I("w_gkl_box", 3, "Монтаж короба из ГКЛ с нишами/полками", "шт.", 12_500, "plasterboard boxes with niches"),
  I("w_primer", 3, "Грунтовка стен 1 слой", "м2", 120, "all wall area"),
  I("w_plaster", 3, "Штукатурка по маякам гипсовой штукатуркой с извлечением маяков", "м2", 1_960, "all walls incl. both sides of new masonry partitions, except plasterboard"),
  I("w_putty_base", 3, "Шпаклёвка стен базовая (2 слоя) с ошкуриванием", "м2", 940, "all walls except tiled"),
  I("w_glass_fiber", 3, "Оклеивание стен стеклохолстом «Паутинка»", "м2", 880, "painted walls only"),
  I("w_putty_finish", 3, "Финишный слой шпаклёвки (2 слоя)", "м2", 1_140, "all walls except tiled"),
  I("w_paint", 3, "Окраска стен (2 слоя)", "м2", 850, "painted walls, incl. 'technical painting' behind furniture"),
  I("w_insulation", 3, "Устройство звуко/теплоизоляции бескаркасная", "м2", 3_345, "", { optional: true, note: "на усмотрение заказчика" }),

  // 4. Полы
  I("f_primer", 4, "Покрытие пола грунтовкой", "м2", 120, "floor area"),
  I("f_prep", 4, "Подготовка пола", "м2", 180, "floor area"),
  I("f_waterproof", 4, "Устройство гидроизоляции обмазочной (2 слоя)", "компл.", 9_900, "one per wet room"),
  I("f_screed", 4, "Цементно-песчаная стяжка", "м2", 1_200, "always: floor area; thickness from project levels"),
  I("f_shower_podium", 4, "Устройство подиума для душевой кабины", "шт.", 14_770, "shower podiums"),
  I("f_soundproof", 4, "Устройство шумоизоляции рулонными материалами", "м2", 1_245, "", { optional: true, note: "на усмотрение заказчика" }),
  I("f_engineered", 4, "Монтаж инженерной доски на готовое основание", "м2", 4_400, "engineered wood / parquet board area"),
  I("f_spc", 4, "Укладка кварцвинила (SPC)", "м2", 1_400, "quartz vinyl / SPC area"),
  I("f_laminate_herringbone", 4, "Укладка ламината ёлочкой", "м2", 2_000, "herringbone laminate area"),
  I("f_skirting", 4, "Монтаж плинтуса до 80 мм", "м/п", 850, "skirting length"),

  // 5. Потолок
  I("c_frame", 5, "Монтаж каркаса ГКЛ", "м2", 3_600, "plasterboard ceiling area"),
  I("c_board", 5, "Обшивка ГКЛ 1 слой", "м2", 1_800, "plasterboard ceiling area"),
  I("c_box", 5, "Короб ГКЛ до 60 см", "м/п", 3_650, "ceiling boxes"),
  I("c_r_box", 5, "R-короб ГКЛ до 60 см", "м/п", 5_500, "rounded ceiling boxes"),
  I("c_joints", 5, "Заделка стыков ГКЛ", "м2", 440, "plasterboard ceiling area"),
  I("c_primer", 5, "Грунтовка потолка", "м2", 160, "plasterboard ceiling area"),
  I("c_putty_base", 5, "Шпаклёвка потолка базовая", "м2", 970, "plasterboard ceiling area"),
  I("c_glass_fiber", 5, "Оклеивание потолка стеклохолстом «Паутинка»", "м2", 980, "plasterboard ceiling area"),
  I("c_putty_finish", 5, "Финишная шпаклёвка потолка", "м2", 1_470, "plasterboard ceiling area"),
  I("c_paint", 5, "Покраска потолка", "м2", 730, "plasterboard ceiling area"),
  I("c_holes", 5, "Сверление отверстий под светильники", "шт.", 1_254, "recessed lights in plasterboard ceiling"),
  I("c_chandelier", 5, "Закладная для люстры", "шт.", 1_800, "chandeliers / pendant lights"),
  I("c_cornice_paint", 5, "Покраска карниза", "м/п", 530, "painted cornices"),
  I("c_soundproof", 5, "Звукоизоляционный каркасный потолок", "м2", 2_989, "only if the project specifies it"),
  I("c_stretch", 5, "Натяжной потолок матовый (монтаж)", "м2", null, "stretch ceiling area", { note: "отдельный договор" }),

  // 6. Плитка
  I("t_primer", 6, "Грунтовка под плитку 2 слоя", "м2", 170, "tiled walls + tiled floors"),
  I("t_floor", 6, "Укладка керамогранита на пол 600×1200", "м2", 6_200, "tiled floor area"),
  I("t_wall", 6, "Укладка керамогранита на стены 600×1200", "м2", 8_200, "tiled wall area from elevations"),
  I("t_backsplash", 6, "Укладка плитки кухонного фартука", "компл.", 28_000, "1 if there is a kitchen backsplash"),
  I("t_cut", 6, "Подрезка плитки/керамогранита", "м/п", 978, "cut length estimate", { note: "по факту" }),
  I("t_reveal", 6, "Укладка керамогранита на откосы", "м/п", 6_200, "tiled reveals"),
  I("t_wall_waterproof", 6, "Гидроизоляция стен", "компл.", 12_200, "one per wet room with tiled walls"),
  I("t_reveal_grout", 6, "Затирка швов на откосах", "м/п", 930, "= tiled reveals"),
  I("t_grout", 6, "Затирка швов", "м2", 930, "tiled walls + floors"),
  I("t_corner", 6, "Устройство наружного угла (под шов)", "м/п", 1_800, "", { optional: true, note: "при необходимости" }),
  I("t_holes", 6, "Сверление отверстий в керамограните", "шт.", 1_300, "plumbing outlets + sockets in tiles", { note: "по факту" }),
  I("t_bath_screen", 6, "Монтаж экрана под ванну", "шт.", 8_000, "bath screens"),

  // 7. Сантехника
  I("p_mixer", 7, "Установка смесителя/гигиенического душа", "шт.", 3_700, "surface-mounted mixers + hygienic showers only", { note: "накладные" }),
  I("p_drain", 7, "Установка трапа", "шт.", 4_332, "floor drains"),
  I("p_toilet", 7, "Установка унитаза (компакт/подвесного)/биде", "шт.", 5_600, "toilets and bidets"),
  I("p_installation", 7, "Установка инсталляции", "шт.", 8_800, "wall-hung toilet frames"),
  I("p_installation_box", 7, "Монтаж сантехнического шкафа/короба под инсталляцию", "шт.", 9_775, "boxes for installations / plumbing cabinets"),
  I("p_radiator", 7, "Монтаж радиатора", "шт.", 7_102, "new radiators"),
  I("p_towel", 7, "Монтаж полотенцесушителя", "шт.", 4_500, "towel warmers"),
  I("p_water_heater", 7, "Монтаж проточного водонагревателя", "шт.", 5_484, "water heaters"),
  I("p_water_node", 7, "Монтаж водоразборного узла", "шт.", 38_000, "water distribution node, usually 1"),
  I("p_heating_manifold", 7, "Монтаж коллекторного узла для системы отопления/водяного ТП", "шт.", 5_000, "2 if new radiators/manifolds"),
  I("p_chasing", 7, "Штробление под сантехнику", "компл.", 22_000, "1 if pipes are chased into walls"),
  I("p_sewer", 7, "Монтаж фановых труб", "точка", 4_550, "sewer points"),
  I("p_pipe", 7, "Прокладка трубы ГВС/ХВС Rehau/Valtec", "м/п", 290, "water pipe length", { note: "по факту" }),
  I("p_outlet", 7, "Монтаж концовки Rehau, Valtec", "отвод", 4_500, "water outlets (hot+cold per fixture)"),
  I("p_bath", 7, "Установка встроенной ванны", "шт.", 8_000, "bathtubs"),

  // 8. Откосы
  I("r_insulation", 8, "Утепление откосов Руспанелями", "м/п", 1_660, "", { optional: true, note: "при необходимости" }),
  I("r_primer", 8, "Грунтовка откосов", "м/п", 120, "reveals of windows, balcony door and entrance door"),
  I("r_beacons", 8, "Установка маяков", "м/п", 390, "= reveals"),
  I("r_plaster", 8, "Штукатурка под маяк", "м/п", 1_150, "= reveals"),
  I("r_corner", 8, "Уголок малярный", "м/п", 260, "= reveals"),
  I("r_putty", 8, "Шпаклёвка откоса 100–250 мм", "м/п", 1_870, "= reveals"),
  I("r_glass_fiber", 8, "Оклейка стеклообоями", "м/п", 880, "= reveals"),
  I("r_sanding", 8, "Ошкуривание", "м/п", 330, "= reveals"),
  I("r_paint", 8, "Окраска откосов", "м/п", 850, "= reveals"),

  // 9. Прочие
  I("o_window_film", 9, "Укрытие окна плёнкой", "шт.", 2_500, "number of windows"),
  I("o_temporary", 9, "Монтаж временной электрики и сантехники", "компл.", 20_000, "always 1"),
];

export const PRICE_BY_ID = new Map(PRICE_LIST.map(item => [item.id, item]));

/** Screed: 1 200 ₽/м² up to 70 mm, +200 ₽ for every started 10 mm above. */
export function screedPrice(thicknessMm: number | null | undefined): { price: number; name: string } {
  const mm = thicknessMm && thicknessMm > 0 ? Math.round(thicknessMm) : 70;
  const extraSteps = Math.max(0, Math.ceil((mm - 70) / 10));
  const price = 1_200 + extraSteps * 200;
  const name = mm > 70
    ? `Цементно-песчаная стяжка ${mm} мм (1 200 до 70 мм + 200 × ${extraSteps})`
    : `Цементно-песчаная стяжка до 70 мм`;
  return { price, name };
}

/** Items that never belong in the estimate, listed back to Egor as "не включено" when seen in a project. */
export const NOT_INCLUDED_EXAMPLES = [
  "LED-лента, блоки питания, световые линии",
  "установка раковины, мойки, диспоузера, фильтра",
  "подключение ПММ, стиральной, сушильной машин",
  "двери",
  "перенос вентиляции, трассы кондиционеров",
  "защита от протечек",
  "демонтаж сантехприборов и конвекторов",
  "поклейка декоративных обоев, молдинги",
  "вывоз мусора, подъём материалов, уборка",
];
