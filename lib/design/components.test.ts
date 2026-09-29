import { describe, expect, it } from 'vitest';
import { COMPONENTS, COMPONENT_KEY, SPLITS, componentDefaults, componentId, defaultDocument, findComponent, parseSettings, recipeRegions, settingsSummary, type ComponentDefinition } from './components';

// The component catalogue: every key well formed and unique, settings read
// against their spec with defaults standing in, the summary in words, Home's
// split recipe naming components that exist.

describe('the component catalogue', () => {
  it('has well-formed, unique keys, one transitional component, and a renderer-side counterpart for each (by name)', () => {
    const keys = COMPONENTS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of COMPONENTS) expect(c.key).toMatch(COMPONENT_KEY);
    expect(COMPONENTS.filter(c => c.legacy).map(c => c.key)).toEqual(['page.body']);
    expect(findComponent('series.live')?.name).toBe('Live band');
    // P2.24 C: Home's six left the catalogue; a stored region naming one is upgraded on read (page-document.ts).
    for (const key of ['home.lead', 'home.live', 'home.result', 'home.changed', 'home.next', 'home.wire']) expect(findComponent(key), key).toBeNull();
    expect(findComponent('nope')).toBeNull();
  });

  it('reads settings against the spec: defaults stand in, a wrong kind, a range miss or an unknown key is a problem', () => {
    const region = findComponent('data.region')!;
    const defaults = componentDefaults(region);
    expect(defaults).toMatchObject({ preset: 'drivers', view: 'table', rows: 10, heading: '', pinned: '' });
    expect(parseSettings(region, undefined)).toEqual({ settings: defaults, problems: [] });
    expect(parseSettings(region, { rows: 12 })).toEqual({ settings: { ...defaults, rows: 12 }, problems: [] });
    expect(parseSettings(region, { rows: 160 })).toEqual({ settings: defaults, problems: ['Rows must be a number from 1 to 150'] });
    expect(parseSettings(region, { rows: 'many' }).problems).toEqual(['Rows must be a number from 1 to 150']);
    expect(parseSettings(region, { colour: 'red' }).problems).toEqual(['Data region has no setting called colour']);
    expect(parseSettings(region, ['x']).problems).toEqual(['the settings must be an object']);
    expect(parseSettings(region, { pinned: 'monza-2026', heading: 'Riders' })).toEqual({ settings: { ...defaults, pinned: 'monza-2026', heading: 'Riders' }, problems: [] });
    expect(parseSettings(region, { pinned: 'x'.repeat(121) }).problems).toEqual(['Pinned post must be text of at most 120 characters']);
  });

  it('P2.1: the Data region reads standings and results (P2.2), posts and news (P2.24 A), weekends (P2.24 B1); no other definition reads one (What it changed left with Home’s six, P2.24 C)', () => {
    expect(findComponent('data.region')?.sources).toEqual(['standings', 'results', 'posts', 'news', 'weekends', 'session-results']);
    // P2.7: the Metric cards read the same six; no other definition reads one.
    expect(findComponent('data.metrics')?.sources).toEqual(['standings', 'results', 'posts', 'news', 'weekends', 'session-results']);
    for (const c of COMPONENTS) if (c.key !== 'data.region' && c.key !== 'data.metrics') expect(c.sources, c.key).toBeUndefined();
  });

  it('P2.2: the Data region’s attributes are per multi-row region: Preset (the thirty-three, grouped by the fifteen, each bound to a source and its series, the results ones waiting), View (Table · Cards), Rows, Heading', () => {
    const region = findComponent('data.region')!;
    expect(region).toMatchObject({ name: 'Data region', group: 'Data' });
    expect(region.settings.map(s => [s.key, s.kind, s.scope])).toEqual([
      ['preset', 'choice', 'report'],
      ['view', 'choice', 'report'],
      ['rows', 'number', 'report'],
      ['heading', 'text', 'report'],
      ['pinned', 'text', 'report'],
      ['cardTitle', 'choice', 'report'],
      ['cardSubtitle', 'choice', 'report'],
      ['cardBody', 'choice', 'report'],
      ['cardMedia', 'choice', 'report'],
      ['cardBadge', 'choice', 'report'],
      ['actionFullCard', 'link', 'report'],
      ['actionTitle', 'link', 'report'],
      ['actionSubtitle', 'link', 'report'],
      ['actionMedia', 'link', 'report'],
      ['actionButton', 'link', 'report'],
      ['actionButtonLabel', 'text', 'report'],
      ['sortable', 'boolean', 'report'],
      ['actions', 'boolean', 'report'],
      ['views', 'boolean', 'report'],
      ['download', 'boolean', 'report'],
      ['highlight1', 'text', 'report'],
      ['highlight1Style', 'choice', 'report'],
      ['highlight2', 'text', 'report'],
      ['highlight2Style', 'choice', 'report'],
      ['highlight3', 'text', 'report'],
      ['highlight3Style', 'choice', 'report'],
      ['highlightFollowed', 'boolean', 'report'],
      ['detailRegion', 'choice', 'report'],
      ['detailKey', 'choice', 'report'],
    ]);
    // P2.2 B3: a preset's pick resets the Card slots and the action zones to its own mapping; a results preset aims Full Card at the row's race page.
    const RESET = { cardTitle: '', cardSubtitle: '', cardBody: '', cardMedia: '', cardBadge: '', actionFullCard: '', actionTitle: '', actionSubtitle: '', actionMedia: '', actionButton: '', actionButtonLabel: 'Open' };
    const preset = region.settings[0];
    expect(preset.options).toHaveLength(39);
    expect(preset.options![0]).toEqual({
      key: 'drivers',
      label: 'Drivers',
      group: 'Drivers',
      only: { source: 'standings', series: ['f1', 'f2', 'f3', 'indycar', 'formula-e', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm'] },
      sets: { view: 'table', ...RESET },
    });
    expect(preset.options!.find(o => o.key === 'imsa-gtp-drivers')).toEqual({ key: 'imsa-gtp-drivers', label: 'GTP — Drivers', group: 'IMSA classes', only: { source: 'standings', series: ['imsa'] }, sets: { view: 'table', ...RESET } });
    // P2.2 B1: the results presets are pickable and bring the Rounds layout (the List view) with them; every option sets its preset's view.
    expect(preset.options!.find(o => o.key === 'season-results')).toEqual({ key: 'season-results', label: 'Season results', group: 'Season results', only: { source: 'results', series: ['f1', 'f3', 'indycar', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm', 'formula-e'] }, sets: { view: 'list', ...RESET, actionFullCard: 'row:race' } });
    expect(preset.options![0].sets).toEqual({ view: 'table', ...RESET });
    for (const o of preset.options!) expect(o.sets?.actionFullCard, o.key).toBe(o.only?.source === 'results' ? 'row:race' : '');
    for (const o of preset.options!) expect(o.later, o.key).toBeUndefined();
    // P2.24 A: Home's two boxes as presets bring their template (a View option) and their rows: the lead and three further, five headlines.
    expect(preset.options!.find(o => o.key === 'lead-story')).toMatchObject({ key: 'lead-story', label: 'Lead story', group: 'Lead story', only: { source: 'posts' }, sets: { view: 'lead-story', rows: 4, ...RESET } });
    expect(preset.options!.find(o => o.key === 'lead-story')!.only!.series).toHaveLength(15);
    expect(preset.options!.find(o => o.key === 'wire')).toMatchObject({ key: 'wire', label: 'The wire', group: 'The wire', only: { source: 'news' }, sets: { view: 'wire', rows: 5, ...RESET } });
    // P2.24 B1: What's next over the weekends source brings its template and three rows.
    expect(preset.options!.find(o => o.key === 'whats-next')).toMatchObject({ key: 'whats-next', label: "What's next", group: "What's next", only: { source: 'weekends' }, sets: { view: 'coming-weekends', rows: 3, ...RESET } });
    // P2.24 B2: Latest result over the results source (Home's series or one championship) brings the Podium template and three rows; What it changed over standings the Leader and five.
    expect(preset.options!.find(o => o.key === 'latest-result')).toEqual({
      key: 'latest-result',
      label: 'Latest result',
      group: 'Latest result',
      only: { source: 'results', series: ['home', 'f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm', 'nls', 'imsa', 'wec', 'gt-world'] },
      sets: { view: 'podium', rows: 3, ...RESET, actionFullCard: 'row:race' },
    });
    expect(preset.options!.find(o => o.key === 'what-it-changed')).toEqual({
      key: 'what-it-changed',
      label: 'What it changed',
      group: 'What it changed',
      only: { source: 'standings', series: ['latest', 'f1', 'f2', 'f3', 'indycar', 'formula-e', 'motogp', 'nascar-cup', 'wsbk', 'wrc', 'dtm'] },
      sets: { view: 'leader', rows: 5, ...RESET },
    });
    // P2.25: the Session preset sets thirty rows too, a full classification without a Rows edit.
    for (const o of preset.options!) expect(Object.keys(o.sets ?? {}).includes('rows'), o.key).toBe(['lead-story', 'wire', 'whats-next', 'latest-result', 'what-it-changed', 'session'].includes(o.key));
    expect(region.settings[1].options!.map(o => [o.key, o.label])).toEqual([
      ['table', 'Table'],
      ['cards', 'Cards'],
      ['list', 'List'],
      ['timeline', 'Timeline'],
      ['detail', 'Detail'],
      ['lead-story', 'Lead story'],
      ['wire', 'The wire'],
      ['headlines', 'Headlines'],
      ['coming-weekends', "What's next"],
      ['podium', 'Latest result'],
      ['leader', 'What it changed'],
    ]);
    expect(region.settings[1].options!.find(o => o.key === 'coming-weekends')).toEqual({ key: 'coming-weekends', label: "What's next", only: { source: 'weekends' } });
    expect(parseSettings(region, { preset: 'whats-next', view: 'coming-weekends' }).settings.view).toBe('coming-weekends');
    // P2.24 B2: the two templates bound to their sources; the parser takes them.
    expect(region.settings[1].options!.find(o => o.key === 'podium')).toEqual({ key: 'podium', label: 'Latest result', only: { source: 'results' } });
    expect(region.settings[1].options!.find(o => o.key === 'leader')).toEqual({ key: 'leader', label: 'What it changed', only: { source: 'standings' } });
    expect(parseSettings(region, { preset: 'latest-result', view: 'podium' }).settings.view).toBe('podium');
    expect(parseSettings(region, { preset: 'what-it-changed', view: 'leader' }).settings.view).toBe('leader');
    // P2.2 B2: Timeline is bound to a Results source (a date to stand on), every series of it; Detail is open to every shape.
    expect(region.settings[1].options!.find(o => o.key === 'timeline')).toEqual({ key: 'timeline', label: 'Timeline', only: { source: 'results' } });
    expect(region.settings[1].options!.find(o => o.key === 'detail')).toEqual({ key: 'detail', label: 'Detail' });
    expect(parseSettings(region, { preset: 'season-results', view: 'timeline' }).settings.view).toBe('timeline');
    // P2.24 A: Home's boxes as templates are View options bound to their sources (APEX: the report templates list, a custom one joining it).
    expect(region.settings[1].options!.find(o => o.key === 'lead-story')).toEqual({ key: 'lead-story', label: 'Lead story', only: { source: 'posts' } });
    expect(region.settings[1].options!.find(o => o.key === 'wire')).toEqual({ key: 'wire', label: 'The wire', only: { source: 'news' } });
    expect(parseSettings(region, { preset: 'lead-story', view: 'lead-story' }).settings.view).toBe('lead-story');
    const pinned = region.settings[4];
    expect(pinned).toMatchObject({ key: 'pinned', label: 'Pinned post', kind: 'text', scope: 'report', default: '', maxLength: 120, dependingOn: { key: 'view', values: ['lead-story'] } });
    expect(region.holds).toBe('a table, cards, a list, a timeline or details over a source from the catalogue, in one of the site’s named shapes, or one of Home’s boxes as a template');
    const HIGHLIGHT = { highlight1: '', highlight1Style: 'brand', highlight2: '', highlight2Style: 'brand', highlight3: '', highlight3Style: 'brand', highlightFollowed: false };
    const DETAIL = { detailRegion: '', detailKey: '' };
    expect(componentDefaults(region)).toEqual({ preset: 'drivers', view: 'table', rows: 10, heading: '', pinned: '', ...RESET, sortable: false, actions: false, views: false, download: false, ...HIGHLIGHT, ...DETAIL });
    expect(parseSettings(region, { preset: 'wec-hypercar-drivers', view: 'cards', rows: 5 }).settings).toEqual({ preset: 'wec-hypercar-drivers', view: 'cards', rows: 5, heading: '', pinned: '', ...RESET, sortable: false, actions: false, views: false, download: false, ...HIGHLIGHT, ...DETAIL });
    // The pinned post is named on the tile while the View is Lead story and a slug is set, silent otherwise.
    expect(settingsSummary(region, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '', pinned: 'monza-2026' })).toBe('Preset Lead story · View Lead story · Rows 4 · Pinned post monza-2026');
    expect(settingsSummary(region, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' })).toBe('Preset Lead story · View Lead story · Rows 4');
    expect(settingsSummary(region, { preset: 'lead-story', view: 'table', rows: 4, heading: '', pinned: 'monza-2026' })).toBe('Preset Lead story · View Table · Rows 4');
    expect(parseSettings(region, { preset: 'nope' }).problems[0]).toMatch(/^Preset must be one of Drivers, Constructors, Teams/);
    expect(parseSettings(region, { rows: 0 }).problems).toEqual(['Rows must be a number from 1 to 150']);
    expect(settingsSummary(region, { preset: 'constructors', view: 'cards', rows: 8, heading: '' })).toMatch(/^Preset Constructors · View Cards · Rows 8/);
    // P2.2 B3: the Card slots and the action zones, under the Card and Actions groups, drawn while the View is Cards (APEX: Depending On).
    expect(region.groups).toEqual([
      { key: 'card', title: 'Card', seq: 10 },
      { key: 'actions', title: 'Actions', seq: 20 },
      { key: 'menu', title: 'Actions Menu', seq: 30 },
      { key: 'highlight', title: 'Highlight', seq: 40 },
      { key: 'detail', title: 'Master Detail', seq: 50 },
    ]);
    // P2.4: three highlight rules (a row condition in the address's words, a style each) and the followed-series tint, under
    // Highlight (APEX: an Interactive Report's Highlight), for the Table, the Cards and the List; the tile names a rule when set.
    const highlight = region.settings.filter(s => s.group === 'highlight');
    expect(highlight.map(s => [s.key, s.label, s.kind, s.default])).toEqual([
      ['highlight1', 'Highlight 1', 'text', ''],
      ['highlight1Style', 'Highlight 1 style', 'choice', 'brand'],
      ['highlight2', 'Highlight 2', 'text', ''],
      ['highlight2Style', 'Highlight 2 style', 'choice', 'brand'],
      ['highlight3', 'Highlight 3', 'text', ''],
      ['highlight3Style', 'Highlight 3 style', 'choice', 'brand'],
      ['highlightFollowed', 'Followed series', 'boolean', false],
    ]);
    for (const s of highlight) expect(s.dependingOn, s.key).toEqual({ key: 'view', values: ['table', 'cards', 'list'] });
    // P2.4 PR C: Master Detail (APEX's name): the region whose rows filter another region of the page through the address,
    // and the column both carry; drawn for the Table, the Cards and the List; the tile names the region's id and the column.
    const detail = region.settings.filter(s => s.group === 'detail');
    expect(detail.map(s => [s.key, s.label, s.kind, s.default, s.optionsFrom])).toEqual([
      ['detailRegion', 'Detail region', 'choice', '', 'regions'],
      ['detailKey', 'Detail key', 'choice', '', 'columns'],
    ]);
    for (const s of detail) expect(s.dependingOn, s.key).toEqual({ key: 'view', values: ['table', 'cards', 'list'] });
    expect(parseSettings(region, { detailRegion: 'results-2', detailKey: 'round' }).settings).toMatchObject({ detailRegion: 'results-2', detailKey: 'round' });
    expect(parseSettings(region, { detailRegion: 'Results Two' }).problems).toEqual(['Detail region must name a region of the page: lower-case letters, digits and dashes']);
    expect(settingsSummary(region, { preset: 'season-results', view: 'list', rows: 8, heading: '', detailRegion: 'results-2', detailKey: 'round' })).toBe('Preset Season results · View List · Rows 8 · Detail region results-2 · Detail key Round');
    for (const s of highlight.filter(x => x.kind === 'text')) expect([s.rule, s.maxLength], s.key).toEqual([true, 120]);
    expect(highlight[1].options!.map(o => [o.key, o.label])).toEqual([['brand', 'Brand'], ['emphasis', 'Emphasis'], ['muted', 'Muted']]);
    expect(settingsSummary(region, { preset: 'drivers', view: 'table', rows: 8, heading: '', highlight1: 'position.eq:1', highlight2: 'position.lte:3', highlight2Style: 'emphasis' })).toBe('Preset Drivers · View Table · Rows 8 · Highlight 1 position.eq:1 · Highlight 2 position.lte:3 · Highlight 2 style Emphasis');
    expect(settingsSummary(region, { preset: 'drivers', view: 'timeline', rows: 8, heading: '', highlight1: 'position.eq:1' })).toBe('Preset Drivers · View Timeline · Rows 8');
    // P2.3: the Interactive Report's controls (APEX: Attributes › Actions Menu), off by default, drawn while the View is Table or Cards;
    // the tile names them only when on (a dependingOn attribute at its default is silent).
    const menu = region.settings.filter(s => s.group === 'menu');
    expect(menu.map(s => [s.key, s.label, s.kind, s.default])).toEqual([
      ['sortable', 'Sortable headings', 'boolean', false],
      ['actions', 'Actions menu', 'boolean', false],
      ['views', 'Saved views', 'boolean', false],
      ['download', 'Download CSV', 'boolean', false],
    ]);
    for (const s of menu) expect(s.dependingOn, s.key).toEqual({ key: 'view', values: ['table', 'cards'] });
    expect(settingsSummary(region, { preset: 'drivers', view: 'table', rows: 8, heading: '', sortable: true, actions: true })).toBe('Preset Drivers · View Table · Rows 8 · Sortable headings yes · Actions menu yes');
    expect(settingsSummary(region, { preset: 'drivers', view: 'list', rows: 8, heading: '', sortable: true })).toBe('Preset Drivers · View List · Rows 8');
    const slots = region.settings.filter(s => s.group === 'card');
    const zones = region.settings.filter(s => s.group === 'actions');
    expect(slots.map(s => [s.key, s.label])).toEqual([
      ['cardTitle', 'Title'],
      ['cardSubtitle', 'Subtitle'],
      ['cardBody', 'Body'],
      ['cardMedia', 'Media'],
      ['cardBadge', 'Badge'],
    ]);
    expect(zones.map(s => [s.key, s.label])).toEqual([
      ['actionFullCard', 'Full Card'],
      ['actionTitle', 'Title action'],
      ['actionSubtitle', 'Subtitle action'],
      ['actionMedia', 'Media action'],
      ['actionButton', 'Button'],
      ['actionButtonLabel', 'Button label'],
    ]);
    for (const s of [...slots, ...zones]) expect(s.dependingOn, s.key).toEqual({ key: 'view', values: ['cards'] });
    for (const s of slots) expect([s.kind, s.optionsFrom, s.default], s.key).toEqual(['choice', 'columns', '']);
    for (const s of zones.slice(0, 5)) expect([s.kind, s.rowLinks, s.default], s.key).toEqual(['link', true, '']);
    expect(zones[5]).toMatchObject({ kind: 'text', default: 'Open', maxLength: 24 });
    expect(parseSettings(region, { cardTitle: 'team', actionFullCard: 'row:race' }).settings).toMatchObject({ cardTitle: 'team', actionFullCard: 'row:race' });
    expect(parseSettings(region, { cardTitle: 'x'.repeat(41) }).problems).toEqual(['Title must name a column of at most 40 characters']);
    // The tile's line names a slot or a zone only while the view is Cards and the value is not the preset's own; a column by its label, a row link by its page.
    expect(settingsSummary(region, { preset: 'drivers', view: 'cards', rows: 8, heading: '', cardTitle: 'team', actionFullCard: 'calendar' })).toBe('Preset Drivers · View Cards · Rows 8 · Title Team · Full Card calendar');
    expect(settingsSummary(region, { preset: 'drivers', view: 'table', rows: 8, heading: '', cardTitle: 'team' })).toBe('Preset Drivers · View Table · Rows 8');
    expect(settingsSummary(region, { preset: 'season-results', view: 'cards', rows: 8, heading: '', actionFullCard: 'row:race' })).toBe('Preset Season results · View Cards · Rows 8 · Full Card Race → its page');
  });

  it('sums settings up in words, and the transitional component by what it holds', () => {
    const band = findComponent('series.live')!;
    expect(settingsSummary(band, { series: 'motogp', also: false })).toBe('Series MotoGP · Also racing no');
    const region = findComponent('data.region')!;
    expect(settingsSummary(region, { ...componentDefaults(region), rows: 8 })).toMatch(/^Preset Drivers · View Table · Rows 8/);
    const legacy = findComponent('page.body')!;
    expect(settingsSummary(legacy, {})).toMatch(/exactly as its code writes it today/);
  });

  it('P2.9: the Live band is a general component in the Series group with a Series choice (every series, or one) and an Also racing toggle, reading no catalogue source; Home’s recipe places it as This weekend’s instance', () => {
    const band = findComponent('series.live')!;
    expect(band).toMatchObject({ name: 'Live band', group: 'Series', holds: 'the weekends under way: a box for the lead series and the majors with the next session and its countdown, one row for the rest' });
    expect(band.sources).toBeUndefined();
    expect(band.settings.map(s => [s.key, s.kind])).toEqual([
      ['series', 'choice'],
      ['also', 'boolean'],
    ]);
    const series = band.settings[0];
    expect(series.options![0]).toEqual({ key: '', label: 'Every series', group: 'Series' });
    expect(series.options).toHaveLength(16);
    expect(series.options!.find(o => o.key === 'f1')).toEqual({ key: 'f1', label: 'Formula 1', group: 'Series' });
    for (const o of series.options!) expect(o.only, o.key).toBeUndefined();
    expect(componentDefaults(band)).toEqual({ series: '', also: true });
    expect(parseSettings(band, { series: 'motogp', also: false }).settings).toEqual({ series: 'motogp', also: false });
    expect(parseSettings(band, { series: 'nope' }).problems[0]).toMatch(/^Series must be one of Every series, /);
    expect(settingsSummary(band, { series: '', also: true })).toBe('Series Every series · Also racing yes');
    expect(SPLITS['/'].map(e => (typeof e === 'string' ? e : `${e.id}:${e.component}`))).toEqual(['lead:data.region', 'live:series.live', 'result:data.region', 'changed:data.region', 'next:data.region', 'wire:data.region']);
    expect(recipeRegions('/').find(r => r.component === 'series.live')).toMatchObject({ id: 'live', settings: { series: '', also: true } });
    expect(recipeRegions('/').find(r => r.component === 'series.live')).not.toHaveProperty('source');
  });

  it('P2.8: the Countdown is a general component in the Series group with a Series choice (every series, or one), a Heading, the time at the track and the links as switches, reading no catalogue source; its tile names what is set', () => {
    const countdown = findComponent('series.countdown')!;
    expect(countdown).toMatchObject({ name: 'Countdown', group: 'Series' });
    expect(countdown.holds).toMatch(/^the next session of one series or the nearest across every series/);
    expect(countdown.sources).toBeUndefined();
    expect(countdown.settings.map(s => [s.key, s.kind])).toEqual([
      ['series', 'choice'],
      ['heading', 'text'],
      ['venueTime', 'boolean'],
      ['link', 'boolean'],
    ]);
    const series = countdown.settings[0];
    expect(series.options![0]).toEqual({ key: '', label: 'Every series', group: 'Series' });
    expect(series.options).toHaveLength(16);
    expect(series.options!.find(o => o.key === 'f1')).toEqual({ key: 'f1', label: 'Formula 1', group: 'Series' });
    expect(componentDefaults(countdown)).toEqual({ series: '', heading: '', venueTime: true, link: true });
    expect(parseSettings(countdown, { series: 'motogp', heading: 'Next up', venueTime: false, link: true }).settings).toEqual({ series: 'motogp', heading: 'Next up', venueTime: false, link: true });
    expect(parseSettings(countdown, { series: 'nope' }).problems[0]).toMatch(/^Series must be one of Every series, /);
    expect(settingsSummary(countdown, componentDefaults(countdown))).toBe('Series Every series · Time at the track yes · Links yes');
    expect(settingsSummary(countdown, { series: 'f1', heading: 'Next up', venueTime: false, link: true })).toBe('Series Formula 1 · Heading Next up · Time at the track no · Links yes');
  });

  it('every split recipe names components the catalogue has', () => {
    expect(SPLITS['/']).toHaveLength(6);
    // P2.5 PR B: the calendar's Filters region before the month, over the calendar's own facets (it has no preset).
    expect(SPLITS['/calendar']).toEqual(['page.heading', { id: 'filters', component: 'data.filters', settings: { filteredRegion: 'month', facet1: 'seriesName', facet2: 'sessionType' } }, 'calendar.month']);
    expect(findComponent('calendar.month')?.facets?.map(c => [c.key, c.label, c.type])).toEqual([['seriesName', 'Series', 'text'], ['sessionType', 'Sessions', 'text']]);
    // P2.5 PR C: the news page's recipe: the heading with the route's words, the Filters region over the wire's series, the wire on the
    // Headlines view over the News page's ten per series, every row shown (the Rows cap raised to 150 for it).
    expect(SPLITS['/news']).toEqual([
      { id: 'heading', component: 'page.heading', settings: { text: 'The wire' } },
      { id: 'filters', component: 'data.filters', settings: { filteredRegion: 'wire', facet1: 'seriesName' } },
      { id: 'wire', component: 'data.region', settings: { preset: 'wire', view: 'headlines', rows: 150 }, source: 'news?per=10' },
    ]);
    expect(findComponent('data.region')?.settings.find(s => s.key === 'rows')).toMatchObject({ min: 1, max: 150 });
    expect(findComponent('data.region')?.settings.find(s => s.key === 'view')).toMatchObject({ options: expect.arrayContaining([{ key: 'headlines', label: 'Headlines', only: { source: 'news' } }]) });
    for (const recipe of Object.values(SPLITS)) for (const entry of recipe) expect(findComponent(typeof entry === 'string' ? entry : entry.component)).not.toBeNull();
  });

  it('lays a recipe out as Body regions: full rows, the two Home halves sharing one, ids from the keys, and a default document from it', () => {
    const home = recipeRegions('/');
    expect(home.map(r => `${r.id}:${r.column}/${r.span}${r.newRow ? '' : ' same row'}:${r.seq}`)).toEqual([
      'lead:1/12:10',
      'live:1/12:20',
      'result:1/12:30',
      'changed:1/6:40',
      'next:7/6 same row:50',
      'wire:1/12:60',
    ]);
    // P2.24 C: Home's boxes are Data regions on their templates over the catalogue's sources; each entry names its id, settings and Source.
    const at = (id: string) => home.find(r => r.id === id)!;
    expect(at('lead')).toMatchObject({ component: 'data.region', settings: { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '', pinned: '' }, source: 'posts?count=10' });
    expect(at('live')).toMatchObject({ component: 'series.live', settings: { series: '', also: true } });
    expect(at('result')).toMatchObject({ component: 'data.region', settings: { preset: 'latest-result', view: 'podium', rows: 3 }, source: 'results?series=home&season=2026' });
    expect(at('changed')).toMatchObject({ component: 'data.region', settings: { preset: 'what-it-changed', view: 'leader', rows: 5 }, source: 'standings?series=latest&season=2026' });
    expect(at('next')).toMatchObject({ component: 'data.region', settings: { preset: 'whats-next', view: 'coming-weekends', rows: 3 }, source: 'weekends?count=10' });
    expect(at('wire')).toMatchObject({ component: 'data.region', settings: { preset: 'wire', view: 'wire', rows: 5 }, source: 'news?per=3' });
    expect(Object.keys(at('wire').settings).sort()).toEqual(Object.keys(componentDefaults(findComponent('data.region')!)).sort());
    expect(recipeRegions('/', ['wire'], 100).map(r => r.id)[5]).toBe('wire-2');
    expect(recipeRegions('/nowhere')).toEqual([]);
    expect(componentId('page.body', [])).toBe('code-body');
    expect(componentId('data.region', ['region', 'region-2'])).toBe('region-3');
    expect(defaultDocument('/calendar').regions.map(r => r.component)).toEqual(['page.heading', 'data.filters', 'calendar.month']);
  });

  it('reads the colour, icon and link kinds, and leaves an application-scope attribute to Component Settings (P2.0)', () => {
    const card: ComponentDefinition = {
      key: 'test.card',
      name: 'Card',
      group: 'Page',
      holds: 'a card',
      groups: [{ key: 'colours', title: 'Colours', seq: 10 }],
      settings: [
        { key: 'accent', label: 'Accent', kind: 'colour', default: '#8c1c13', group: 'colours' },
        { key: 'icon', label: 'Icon', kind: 'icon', default: '' },
        { key: 'more', label: 'Read more', kind: 'link', default: '' },
        { key: 'theme', label: 'Theme', kind: 'text', default: 'paper', maxLength: 20, scope: 'application' },
      ],
    };
    expect(componentDefaults(card)).toEqual({ accent: '#8c1c13', icon: '', more: '' });
    expect(parseSettings(card, { accent: '#ABCDEF' })).toEqual({ settings: { accent: '#abcdef', icon: '', more: '' }, problems: [] });
    expect(parseSettings(card, { accent: 'red' }).problems).toEqual(['Accent must be a colour as #rrggbb']);
    expect(parseSettings(card, { icon: 'calendar' }).settings.icon).toBe('calendar');
    expect(parseSettings(card, { icon: 'Calendar!' }).problems).toEqual(['Icon must be an icon name: lower-case letters, digits and dashes']);
    expect(parseSettings(card, { more: 'page:a1b2c3d4-0000-4000-8000-000000000010' }).settings.more).toBe('page:a1b2c3d4-0000-4000-8000-000000000010');
    expect(parseSettings(card, { more: 'x'.repeat(121) }).problems).toEqual(['Read more must name a destination of at most 120 characters']);
    expect(parseSettings(card, { theme: 'midnight' }).problems).toEqual(['Theme is set for the application, not on a region']);
    expect(settingsSummary(card, {})).toBe('Accent #8c1c13 · Icon none · Read more nowhere');
    expect(findComponent('test.card')).toBeNull();
    expect(findComponent('test.card', [...COMPONENTS, card])?.name).toBe('Card');
  });
});

describe('the Filters component (P2.5; APEX: Smart Filters)', () => {
  it('names its Data region, three facets over that region’s columns with a label, Depending On and a picks-several switch, in one Facets group; it reads no source of its own', () => {
    const spec = findComponent('data.filters')!;
    expect(spec).toMatchObject({ name: 'Filters', group: 'Data' });
    expect(spec.sources).toBeUndefined();
    expect(spec.groups).toEqual([{ key: 'facets', title: 'Facets', seq: 10 }]);
    expect(spec.settings.map(s => [s.key, s.kind, s.optionsFrom ?? null])).toEqual([
      ['filteredRegion', 'choice', 'regions'],
      ['facet1', 'choice', 'columns'], ['facet1Label', 'text', null], ['facet1DependsOn', 'choice', 'facets'], ['facet1Several', 'boolean', null],
      ['facet2', 'choice', 'columns'], ['facet2Label', 'text', null], ['facet2DependsOn', 'choice', 'facets'], ['facet2Several', 'boolean', null],
      ['facet3', 'choice', 'columns'], ['facet3Label', 'text', null], ['facet3DependsOn', 'choice', 'facets'], ['facet3Several', 'boolean', null],
    ]);
    for (const s of spec.settings) expect(s.scope, s.key).toBe('report');
    const ok = parseSettings(spec, { filteredRegion: 'drivers', facet1: 'team', facet2: 'name', facet2DependsOn: 'facet1', facet2Several: true });
    expect(ok.problems).toEqual([]);
    expect(ok.settings).toMatchObject({ filteredRegion: 'drivers', facet1: 'team', facet2: 'name', facet2DependsOn: 'facet1', facet2Several: true });
    expect(parseSettings(spec, { facet1DependsOn: 'nope' }).problems).toEqual(['Facet 1 depends on must name another facet']);
    expect(parseSettings(spec, { facet1DependsOn: 'facet1' }).problems).toEqual(['Facet 1 depends on must name another facet']);
    expect(parseSettings(spec, { filteredRegion: 'Bad Id' }).problems).toEqual(['Filtered region must name a region of the page: lower-case letters, digits and dashes']);
    const summary = settingsSummary(spec, { filteredRegion: 'drivers', facet1: 'team' });
    expect(summary).toBe('Filtered region drivers · Facet 1 team');
  });
});

describe('the Metric cards component (P2.7; APEX 26.1: the Metric Card theme component)', () => {
  it('draws figures over a preset’s rows: the preset (the same options as the Data region’s, none setting anything else), a heading, the columns per row, and four cards each with a label, a figure, a value, a description and a trend column and a row rule, in a group each; the summary names the preset, the columns and the cards set', () => {
    const metrics = findComponent('data.metrics')!;
    expect(metrics).toMatchObject({ name: 'Metric cards', group: 'Data' });
    const cards = [1, 2, 3, 4].flatMap(n => [
      [`card${n}Label`, 'text', `card${n}`],
      [`card${n}Figure`, 'choice', `card${n}`],
      [`card${n}Value`, 'choice', `card${n}`],
      [`card${n}Description`, 'choice', `card${n}`],
      [`card${n}Trend`, 'choice', `card${n}`],
      [`card${n}Row`, 'text', `card${n}`],
    ]);
    expect(metrics.settings.map(s => [s.key, s.kind, s.group])).toEqual([['preset', 'choice', undefined], ['heading', 'text', undefined], ['columns', 'choice', undefined], ...cards]);
    expect(metrics.settings.every(s => s.scope === 'report')).toBe(true);
    expect(metrics.groups?.map(g => [g.key, g.title])).toEqual([['card1', 'Card 1'], ['card2', 'Card 2'], ['card3', 'Card 3'], ['card4', 'Card 4']]);
    // The preset options are the Data region's, bound to the source and its series, and set nothing else: the Data region's
    // resets (the View, the Rows, the Card slots) are foreign keys here, and a pick spreading them would have the parser drop the region.
    const preset = metrics.settings[0];
    const region = findComponent('data.region')!.settings[0];
    expect(preset.options?.map(o => [o.key, o.label, o.group, o.only])).toEqual(region.options?.map(o => [o.key, o.label, o.group, o.only]));
    expect(preset.options?.every(o => o.sets === undefined)).toBe(true);
    expect(preset.default).toBe('drivers');
    expect(parseSettings(metrics, { view: 'table' }).problems).toEqual(['Metric cards has no setting called view']);
    // The value, the description, the trend and the row wait on the figure being a column value (a count card carries its label alone).
    for (const n of [1, 2, 3, 4]) {
      expect(metrics.settings.find(s => s.key === `card${n}Figure`)).toMatchObject({ default: 'value', options: [{ key: 'value', label: 'Column value' }, { key: 'count', label: 'Row count' }] });
      for (const k of ['Value', 'Description', 'Trend']) expect(metrics.settings.find(s => s.key === `card${n}${k}`)).toMatchObject({ optionsFrom: 'columns', default: '', dependingOn: { key: `card${n}Figure`, values: ['value'] } });
      expect(metrics.settings.find(s => s.key === `card${n}Row`)).toMatchObject({ rule: true, default: '', dependingOn: { key: `card${n}Figure`, values: ['value'] } });
    }
    expect(metrics.settings.find(s => s.key === 'columns')).toMatchObject({ default: '3', options: [{ key: '2', label: '2' }, { key: '3', label: '3' }, { key: '4', label: '4' }] });
    expect(settingsSummary(metrics, { preset: 'drivers', columns: '3', card1Label: 'Leader', card1Value: 'name', card1Description: 'points', card2Label: 'Gap to second', card2Value: 'gap', card2Row: 'position.eq:2', card3Value: 'wins', card4Figure: 'count' })).toBe('Preset Drivers · Columns 3 · Cards Leader, Gap to second, Wins, Rows');
    expect(settingsSummary(metrics, { preset: 'drivers' })).toBe('Preset Drivers · Columns 3 · no card');
  });
});
