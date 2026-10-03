// 語言：?lang=tc（預設，繁體）、sc（簡體）、en（英文）。
// 畫面上所有固定的字都經過 TR()：程式裡寫繁體，這裡查表換成簡體或英文。里程碑的名稱在 milestones.js 裡三種都有。
(function (root) {
  'use strict';
  const LANG = new URLSearchParams(location.search).get('lang') || 'tc';
  const SC = {
    機: '机', 網: '网', '現在': '现在', '約 4 萬年前': '约 4 万年前', '美索不達米亞': '美索不达米亚', '示意，不是真的城市': '示意，不是真实的城市',
    '埃及　吉薩': '埃及　吉萨', '中國　北京': '中国　北京', '美國　甘迺迪角': '美国　肯尼迪角', '英國　索爾茲伯里平原': '英国　索尔兹伯里平原', '希臘　雅典': '希腊　雅典',
    '中國　長城': '中国　长城', '義大利　羅馬': '意大利　罗马', '柬埔寨　吳哥': '柬埔寨　吴哥', '法國　巴黎': '法国　巴黎', '離地 420 公里': '离地 420 公里', '20 公尺': '20 米',
    '約四萬年前': '约四万年前', '西元前 2500 年': '公元前 2500 年', '西元前 2560 年': '公元前 2560 年', '西元前 600 年': '公元前 600 年', '西元前 432 年': '公元前 432 年', '西元前 214 年': '公元前 214 年',
    '西元 80 年': '公元 80 年', '西元前 130 年起': '公元前 130 年起', '巨石陣': '巨石阵', '巴比倫': '巴比伦', '帕德嫩神廟': '帕特农神庙', '長城': '长城', '羅馬競技場': '罗马斗兽场', '吳哥窟': '吴哥窟',
    '天壇': '天坛', '泰姬瑪哈陵': '泰姬陵', '艾菲爾鐵塔': '埃菲尔铁塔', '國際太空站': '国际空间站', '晶片': '芯片', '絲綢之路': '丝绸之路', '鐵路': '铁路', '航線與網路': '航线与网络',
    '下一行，由我們來寫。': '下一行，由我们来写。',
  };
  const EN = {
    手: 'HAND', 火: 'FIRE', 田: 'FIELD', 城: 'CITY', 路: 'ROAD', 海: 'SEA', 機: 'MACHINE', 家: 'HOME', 網: 'NETWORK',
    '現在': 'Today', '約 4 萬年前': 'c. 40,000 years ago', '1972 年 12 月 7 日': 'December 7, 1972', '5,000 公里': '5,000 km', '2,000 公里': '2,000 km', '20 公尺': '20 m',
    '美索不達米亞': 'Mesopotamia', '示意，不是真的城市': 'Illustrative — not a real city', '示意': 'Illustrative', '埃及　吉薩': 'Giza, Egypt', '中國　北京': 'Beijing, China', '印度　阿格拉': 'Agra, India',
    '美國　甘迺迪角': 'Cape Kennedy, USA', '英國　索爾茲伯里平原': 'Salisbury Plain, England', '希臘　雅典': 'Athens, Greece', '中國　長城': 'The Great Wall, China', '義大利　羅馬': 'Rome, Italy',
    '柬埔寨　吳哥': 'Angkor, Cambodia', '法國　巴黎': 'Paris, France', '離地 420 公里': '420 km above Earth',
    '約四萬年前': 'c. 40,000 years ago', '西元前 2500 年': 'c. 2500 BC', '西元前 2560 年': 'c. 2560 BC', '西元前 600 年': 'c. 600 BC', '西元前 432 年': '432 BC', '西元前 214 年': 'c. 214 BC', '西元 80 年': 'AD 80',
    '1150 年': 'c. 1150', '1420 年': '1420', '1653 年': '1653', '1889 年': '1889', '1969 年': '1969', '1972 年': '1972', '1998 年': '1998',
    '西元前 130 年起': 'From 130 BC', '1405 年起': 'From 1405', '1830 年起': 'From 1830',
    '手印': 'Hand stencil', '巨石陣': 'Stonehenge', '金字塔': 'The Pyramids', '巴比倫': 'Babylon', '帕德嫩神廟': 'The Parthenon', '長城': 'The Great Wall', '羅馬競技場': 'The Colosseum', '吳哥窟': 'Angkor Wat',
    '天壇': 'Temple of Heaven', '泰姬瑪哈陵': 'Taj Mahal', '艾菲爾鐵塔': 'The Eiffel Tower', '登月火箭': 'Saturn V', '地球': 'Earth', '國際太空站': 'Space Station', '城市': 'The City', '晶片': 'The Chip',
    '絲綢之路': 'The Silk Road', '大航海': 'The Age of Sail', '鐵路': 'Railways', '航線與網路': 'Airways & Networks',
    '下一行，由我們來寫。': 'The next line is ours to write.',
  };
  const T = LANG === 'sc' ? SC : LANG === 'en' ? EN : {};
  root.LANG = LANG;
  root.TR = (s) => (s in T ? T[s] : s);
  root.UNITS = { tc: ['公釐', '公分', '公尺', '公里'], sc: ['毫米', '厘米', '米', '公里'], en: ['mm', 'cm', 'm', 'km'] }[LANG];
  // 字體：三種語言各用一套開源的襯線體（SIL Open Font License）。檔案在 fonts/
  root.FONTFILE = { tc: 'fonts/NotoSerifTC.ttf', sc: 'fonts/NotoSerifSC.ttf', en: 'fonts/EBGaramond.ttf' }[LANG];
  root.FONTF = '"CivSerif", "Songti TC", serif';
  root.EN = LANG === 'en';
})(typeof self !== 'undefined' ? self : this);
