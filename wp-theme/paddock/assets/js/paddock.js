/**
 * Paddock's one script. The publisher writes every time in UTC as
 * <span class="pd-t" data-utc="…" data-f="…">fallback text</span>; this turns
 * them into the reader's own zone, runs the countdown, and works out Live and
 * Next from the published timetable (data-pd-start / data-pd-end). Without
 * JavaScript the UTC fallback text stays. A [data-pd-now] attribute freezes
 * "now", on a local preview only.
 */
( function () {
	var frozen = /^(localhost|127\.0\.0\.1)$/.test( location.hostname ) ? document.querySelector( '[data-pd-now]' ) : null;
	var zone = 'UTC';
	try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone; } catch {}
	var fmt = function ( o ) { return new Intl.DateTimeFormat( 'en-GB', Object.assign( { timeZone: zone }, o ) ); };
	var fWd = fmt( { weekday: 'short' } ), fT = fmt( { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } );
	var fDay = fmt( { year: 'numeric', month: '2-digit', day: '2-digit' } ), fD = fmt( { weekday: 'short', day: 'numeric', month: 'short' } );

	function inWords( ms ) {
		var m = Math.max( 0, Math.round( ms / 60000 ) ), h = Math.floor( m / 60 );
		if ( h >= 48 ) { return 'in ' + Math.floor( h / 24 ) + ' days'; }
		return h > 0 ? 'in ' + h + ' h ' + ( m % 60 ) + ' min' : 'in ' + m + ' min';
	}

	function nowAt() {
		var pinned = frozen ? Date.parse( frozen.getAttribute( 'data-pd-now' ) ) : NaN;
		return isNaN( pinned ) ? Date.now() : pinned;
	}

	/** The reader's own calendar day of an instant, as YYYY-MM-DD. */
	function isoDay( t ) {
		var p = {};
		fDay.formatToParts( new Date( t ) ).forEach( function ( x ) { p[ x.type ] = x.value; } );
		return p.year + '-' + p.month + '-' + p.day;
	}

	function render() {
		var now = nowAt();
		var today = fDay.format( new Date( now ) );

		// The countdown follows the hero's own timetable, so it stays right between publisher runs.
		document.querySelectorAll( '.pd-hero [data-pd-target]' ).forEach( function ( el ) {
			var next = null;
			el.closest( '.pd-hero' ).querySelectorAll( '.pd-sessions .pd-st[data-pd-start]' ).forEach( function ( st ) {
				if ( ! next && Date.parse( st.getAttribute( 'data-pd-start' ) ) > now ) { next = st; }
			} );
			if ( ! next ) { return; }
			var start = next.getAttribute( 'data-pd-start' ), name = next.parentNode.querySelector( 'strong' );
			var label = el.querySelector( '.pd-cd-to strong' ), time = el.querySelector( '.pd-cd-to .pd-t' );
			el.setAttribute( 'data-pd-target', start );
			if ( label && name ) { label.textContent = name.textContent; }
			if ( time ) { time.setAttribute( 'data-utc', start ); }
		} );

		document.querySelectorAll( '.pd-t[data-utc]' ).forEach( function ( el ) {
			var d = new Date( el.getAttribute( 'data-utc' ) );
			if ( isNaN( d.getTime() ) ) { return; }
			var f = el.getAttribute( 'data-f' );
			if ( f === 't' ) { el.textContent = fT.format( d ); }
			else if ( f === 'wt' ) { el.textContent = fWd.format( d ) + ' ' + fT.format( d ); }
			else if ( f === 'd' ) { el.textContent = fD.format( d ); }
			else if ( f === 'row' ) {
				el.textContent = '';
				if ( fDay.format( d ) !== today ) {
					var s = document.createElement( 'small' );
					s.textContent = fWd.format( d );
					el.appendChild( s );
				}
				el.appendChild( document.createTextNode( fT.format( d ) ) );
			}
		} );
		document.querySelectorAll( '[data-pd-zone]' ).forEach( function ( el ) { el.textContent = zone.split( '/' ).pop().replace( /_/g, ' ' ); } );

		document.querySelectorAll( '[data-pd-target]' ).forEach( function ( el ) {
			var left = Date.parse( el.getAttribute( 'data-pd-target' ) ) - now;
			el.hidden = ! ( left > 0 );
			if ( el.hidden ) { return; }
			var m = Math.round( left / 60000 ), h = Math.floor( m / 60 );
			var units = h >= 24 ? [ Math.floor( h / 24 ), 'day', h % 24, 'hour' ] : [ h, 'hour', m % 60, 'minute' ];
			[ 'a', 'b' ].forEach( function ( k, i ) {
				var n = el.querySelector( '[data-pd-cd="' + k + '"]' ), l = el.querySelector( '[data-pd-cdl="' + k + '"]' );
				if ( n ) { n.textContent = String( units[ i * 2 ] ); }
				if ( l ) { l.textContent = units[ i * 2 + 1 ] + ( units[ i * 2 ] === 1 ? '' : 's' ); }
			} );
		} );

		document.querySelectorAll( '.pd-sessions, .pd-rows' ).forEach( function ( group ) {
			var nextFound = false;
			group.querySelectorAll( '.pd-st[data-pd-start]' ).forEach( function ( st ) {
				var start = Date.parse( st.getAttribute( 'data-pd-start' ) ), end = Date.parse( st.getAttribute( 'data-pd-end' ) ) || start;
				var item = st.closest( '.pd-ses, li' ), row = group.classList.contains( 'pd-rows' );
				if ( ! item ) { return; }
				item.classList.remove( 'is-live', 'is-next', 'is-done' );
				if ( now >= start && now < end ) {
					item.classList.add( 'is-live' );
					st.className = row ? 'pd-st pd-pill pd-pill-live' : 'pd-st';
					st.textContent = row ? '● Live' : '● Live · started ' + fT.format( new Date( start ) );
				} else if ( now >= end ) {
					item.classList.add( 'is-done' );
					st.className = 'pd-st';
					st.textContent = row ? '' : 'Done';
				} else if ( ! nextFound ) {
					nextFound = true;
					item.classList.add( 'is-next' );
					st.className = row ? 'pd-st pd-pill pd-pill-next' : 'pd-st';
					st.textContent = row ? 'Next' : 'Next · ' + inWords( start - now );
				} else {
					st.className = 'pd-st';
					st.textContent = '';
				}
			} );
		} );

		document.querySelectorAll( '.pd-live-src[data-pd-start]' ).forEach( function ( src ) {
			var start = Date.parse( src.getAttribute( 'data-pd-start' ) ), end = Date.parse( src.getAttribute( 'data-pd-end' ) );
			var strip = src.closest( '.pd-live' );
			if ( strip ) { strip.classList.toggle( 'is-off', ! ( now >= start && now < end ) ); }
		} );

		document.querySelectorAll( '.pd-cal' ).forEach( function ( cal ) { calendarStates( cal, now, isoDay( now ) ); } );
	}

	// ── The Calendar (O12) ──────────────────────────────────────────────────
	// The publisher writes each month in UTC (lib/wp/render.ts calendarMonthPages). This moves every session to
	// the reader's own day, adds the views and the Filters tab, fits the month to the window, and marks the clock change.
	var fOff = null, fAbbr = null;
	try { fOff = fmt( { timeZoneName: 'shortOffset' } ); fAbbr = fmt( { timeZoneName: 'short' } ); } catch {}
	var calStore = {
		get: function ( k ) { try { return window.localStorage.getItem( k ); } catch { return null; } },
		set: function ( k, v ) { try { window.localStorage.setItem( k, v ); } catch {} }
	};
	var hiddenOf = function ( key ) { return ( calStore.get( key ) || '' ).split( ',' ).filter( Boolean ); };
	var byStart = function ( a, b ) { return a.getAttribute( 'data-utc' ) < b.getAttribute( 'data-utc' ) ? -1 : 1; };
	// A grid day's data-date is a calendar date, not an instant: named in UTC so no zone shifts it.
	var fDayName = new Intl.DateTimeFormat( 'en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' } );
	var wallClock = function ( ms ) { return new Date( ms ).toISOString().slice( 11, 16 ); };

	function zonePart( f, t ) {
		var p = f.formatToParts( new Date( t ) ).filter( function ( x ) { return x.type === 'timeZoneName'; } )[ 0 ];
		return p ? p.value : '';
	}

	/** Minutes east of UTC, from "GMT+3", "GMT-4:30" or plain "GMT". */
	function offsetMinutes( t ) {
		var m = /GMT([+-])(\d{1,2})(?::(\d\d))?/.exec( zonePart( fOff, t ) );
		return m ? ( m[ 1 ] === '-' ? -1 : 1 ) * ( Number( m[ 2 ] ) * 60 + Number( m[ 3 ] || 0 ) ) : 0;
	}

	/** Round 2's note on the day the reader's clocks change: "Clocks go back 04:00 → 03:00. Times from here are EET (UTC+2)." */
	function clockNote( cal ) {
		var cells = cal.querySelectorAll( '.pd-cal-ses[data-date]' );
		if ( ! fOff || ! cells.length ) { return; }
		var from = Date.parse( cells[ 0 ].getAttribute( 'data-date' ) + 'T00:00:00Z' ) - 864e5;
		var to = Date.parse( cells[ cells.length - 1 ].getAttribute( 'data-date' ) + 'T00:00:00Z' ) + 2 * 864e5;
		var before = offsetMinutes( from );
		for ( var t = from + 9e5; t <= to; t += 9e5 ) {
			var after = offsetMinutes( t );
			if ( after === before ) { continue; }
			var cell = cal.querySelector( '.pd-cal-ses[data-date="' + isoDay( t ) + '"]' );
			if ( cell ) {
				var mins = Math.abs( after ), abbr = fAbbr ? zonePart( fAbbr, t ) : '';
				var utc = 'UTC' + ( after < 0 ? '−' : '+' ) + Math.floor( mins / 60 ) + ( mins % 60 ? ':' + ( '0' + ( mins % 60 ) ).slice( -2 ) : '' );
				var note = document.createElement( 'span' );
				note.className = 'pd-cal-clock';
				note.textContent = 'Clocks go ' + ( after < before ? 'back ' : 'forward ' ) + wallClock( t + before * 6e4 ) + ' → ' + wallClock( t + after * 6e4 ) +
					'. Times from here are ' + ( /^[A-Z]{3,5}$/.test( abbr ) ? abbr + ' (' + utc + ')' : utc ) + '.';
				cell.insertBefore( note, cell.firstChild );
			}
			before = after;
		}
	}

	/** A card's sessions in rows of the reader's own days. */
	function regroupCard( card ) {
		var days = card.querySelector( '.pd-wc-days' );
		if ( ! days ) { return; }
		// A session whose time does not parse is left out, rather than stop the script.
		var items = Array.prototype.filter.call( days.querySelectorAll( '.pd-wc-s' ), function ( s ) { return isFinite( Date.parse( s.getAttribute( 'data-utc' ) ) ); } ).sort( byStart );
		var rows = {};
		days.textContent = '';
		items.forEach( function ( s ) {
			var day = isoDay( s.getAttribute( 'data-utc' ) );
			if ( ! rows[ day ] ) {
				var row = document.createElement( 'div' ), label = document.createElement( 'span' ), list = document.createElement( 'div' );
				row.className = 'pd-wc-day';
				row.setAttribute( 'data-date', day );
				label.className = 'pd-wc-dl';
				label.textContent = fWd.format( new Date( s.getAttribute( 'data-utc' ) ) );
				list.className = 'pd-wc-ss';
				row.appendChild( label );
				row.appendChild( list );
				days.appendChild( row );
				rows[ day ] = list;
			}
			rows[ day ].appendChild( s );
		} );
	}

	/** The events packed into each week's rows again, so a filtered series leaves no gap. In Month view the weeks
	 *  share the window's height (24px day row, 19px band rows, as style.css draws them) and a week with more events
	 *  than fit says "+N more" on the days it hides; a click opens the week. Week view takes as many 23px band rows
	 *  as the packing needs, the sessions below them. */
	function fitMonth( cal ) {
		var grid = cal.querySelector( '.pd-cal-grid' ), weeks = cal.querySelectorAll( '.pd-cal-wk' ), fit = 99;
		var month = cal.getAttribute( 'data-view' ) === 'month';
		cal.querySelectorAll( '.pd-cal-over' ).forEach( function ( el ) { el.remove(); } );
		if ( ! grid || ! weeks.length ) { return; }
		if ( month ) {
			var dow = grid.querySelector( '.pd-cal-dow' );
			var room = window.innerHeight - ( grid.getBoundingClientRect().top + window.scrollY ) - ( dow ? dow.offsetHeight : 0 ) - 12;
			var height = Math.max( 100, Math.min( 176, Math.floor( room / weeks.length ) ) );
			cal.style.setProperty( '--pd-wk-h', height + 'px' );
			fit = Math.floor( ( height - 24 ) / 19 );
		}
		var at = function ( band, letter ) { return Number( ( new RegExp( '\\bpd-' + letter + '(\\d)\\b' ).exec( band.className ) || [ 0, 1 ] )[ 1 ] ); };
		weeks.forEach( function ( week ) {
			var rows = [], placed = [], over = [ 0, 0, 0, 0, 0, 0, 0 ];
			week.querySelectorAll( '.pd-cal-band' ).forEach( function ( band ) {
				if ( band.classList.contains( 'is-filtered' ) ) { return; }
				var a = at( band, 'c' ) - 1, b = a + at( band, 'w' ) - 1, r = 0;
				while ( rows[ r ] && rows[ r ].some( function ( x ) { return ! ( b < x[ 0 ] || a > x[ 1 ] ); } ) ) { r++; }
				( rows[ r ] = rows[ r ] || [] ).push( [ a, b ] );
				placed.push( [ band, r, a, b ] );
			} );
			var limit = rows.length > fit ? fit - 1 : fit;
			week.style.gridTemplateRows = month ? '' : '30px ' + ( rows.length ? 'repeat(' + rows.length + ', 23px) ' : '' ) + 'minmax(64px, auto)';
			week.querySelectorAll( '.pd-cal-ses' ).forEach( function ( cell ) { cell.style.gridRow = month ? '' : String( rows.length + 2 ); } );
			placed.forEach( function ( p ) {
				p[ 0 ].style.gridRow = String( p[ 1 ] + 2 );
				p[ 0 ].classList.toggle( 'is-over', p[ 1 ] >= limit );
				for ( var d = p[ 2 ]; p[ 1 ] >= limit && d <= p[ 3 ]; d++ ) { over[ d ]++; }
			} );
			over.forEach( function ( count, d ) {
				if ( ! count ) { return; }
				var more = document.createElement( 'button' );
				more.type = 'button';
				more.className = 'pd-cal-over pd-c' + ( d + 1 );
				more.style.gridRow = String( limit + 2 );
				more.textContent = '+' + count + ' more';
				var dn = week.querySelector( '.pd-cal-dn.pd-c' + ( d + 1 ) );
				if ( dn ) { more.setAttribute( 'aria-label', count + ' more event' + ( count === 1 ? '' : 's' ) + ' on ' + fDayName.format( new Date( dn.getAttribute( 'data-date' ) + 'T12:00:00Z' ) ) + ', open the week' ); }
				week.appendChild( more );
			} );
		} );
	}

	/** The series and the kinds of session the reader has unticked are hidden, with any card, day or weekend left
	 *  empty by them; the Filters tab counts them. */
	function applyFilter( cal ) {
		var offSeries = hiddenOf( 'pd-off-series' ), offKinds = hiddenOf( 'pd-off-kinds' );
		cal.querySelectorAll( '.pd-cs, .pd-cal-band, .pd-wc, .pd-wc-s' ).forEach( function ( el ) {
			var series = el.getAttribute( 'data-s' ), kind = el.getAttribute( 'data-kind' );
			el.classList.toggle( 'is-filtered', ( series !== null && offSeries.indexOf( series ) >= 0 ) || ( kind !== null && offKinds.indexOf( kind ) >= 0 ) );
		} );
		cal.querySelectorAll( '.pd-wc-day' ).forEach( function ( day ) { day.classList.toggle( 'is-filtered', ! day.querySelector( '.pd-wc-s:not(.is-filtered)' ) ); } );
		cal.querySelectorAll( '.pd-wc' ).forEach( function ( card ) {
			if ( card.querySelector( '.pd-wc-s' ) && ! card.querySelector( '.pd-wc-s:not(.is-filtered)' ) ) { card.classList.add( 'is-filtered' ); }
		} );
		cal.querySelectorAll( '.pd-cal-wkend' ).forEach( function ( wk ) { wk.classList.toggle( 'is-filtered', ! wk.querySelector( '.pd-wc:not(.is-filtered)' ) ); } );
		var tab = cal.querySelector( '.pd-cal-ftab' ), count = offSeries.length + offKinds.length;
		if ( tab ) { tab.textContent = count ? 'Filters · ' + count : 'Filters'; }
		fitMonth( cal );
		calendarStates( cal, nowAt(), isoDay( nowAt() ) );
	}

	/** One dropdown of checkboxes: ticked shows, unticked hides, All and None below; kept in this browser under `key`. */
	function filterMenu( cal, title, key, items ) {
		var menu = document.createElement( 'details' ), head = document.createElement( 'summary' ), list = document.createElement( 'div' );
		menu.className = 'pd-cal-menu';
		head.textContent = title;
		list.className = 'pd-cal-mlist';
		var boxes = items.map( function ( item ) {
			var label = document.createElement( 'label' ), box = document.createElement( 'input' );
			box.type = 'checkbox';
			box.checked = hiddenOf( key ).indexOf( item[ 0 ] ) < 0;
			if ( item[ 2 ] ) { label.className = item[ 2 ]; }
			box.addEventListener( 'change', function () {
				var off = hiddenOf( key ), at = off.indexOf( item[ 0 ] );
				if ( box.checked && at >= 0 ) { off.splice( at, 1 ); }
				if ( ! box.checked && at < 0 ) { off.push( item[ 0 ] ); }
				calStore.set( key, off.join( ',' ) );
				applyFilter( cal );
			} );
			label.appendChild( box );
			label.appendChild( document.createTextNode( item[ 1 ] ) );
			list.appendChild( label );
			return box;
		} );
		var foot = document.createElement( 'div' );
		foot.className = 'pd-cal-mfoot';
		[ [ 'All', '' ], [ 'None', items.map( function ( item ) { return item[ 0 ]; } ).join( ',' ) ] ].forEach( function ( choice ) {
			var b = document.createElement( 'button' );
			b.type = 'button';
			b.textContent = choice[ 0 ];
			b.addEventListener( 'click', function () {
				calStore.set( key, choice[ 1 ] );
				boxes.forEach( function ( box ) { box.checked = choice[ 1 ] === ''; } );
				applyFilter( cal );
			} );
			foot.appendChild( b );
		} );
		list.appendChild( foot );
		menu.appendChild( head );
		menu.appendChild( list );
		return menu;
	}

	/** The Filters tab opens a bar with a Series dropdown (from the published chips) and a Sessions dropdown. */
	function buildFilters( cal ) {
		var source = cal.querySelector( '.pd-cal-filter' ), views = cal.querySelector( '[data-pd-views]' );
		if ( ! source || ! views ) { return; }
		var bar = document.createElement( 'div' ), tab = document.createElement( 'button' );
		bar.className = 'pd-cal-fbar';
		bar.hidden = true;
		// A series with nothing this month stays in the list, greyed, as its chip was.
		var series = Array.prototype.map.call( source.querySelectorAll( '.pd-cal-chip' ), function ( chip ) {
			return [ chip.getAttribute( 'data-s' ), chip.textContent, 'pd-s-' + chip.getAttribute( 'data-s' ) + ( chip.classList.contains( 'pd-dim' ) ? ' pd-dim' : '' ) ];
		} );
		bar.appendChild( filterMenu( cal, 'Series', 'pd-off-series', series ) ).classList.add( 'is-series' );
		bar.appendChild( filterMenu( cal, 'Sessions', 'pd-off-kinds', [ [ 'practice', 'Practice' ], [ 'qualifying', 'Qualifying' ], [ 'race', 'Race' ] ] ) );
		source.replaceWith( bar );
		tab.type = 'button';
		tab.className = 'pd-cal-ftab';
		tab.setAttribute( 'aria-expanded', 'false' );
		tab.addEventListener( 'click', function () {
			bar.hidden = ! bar.hidden;
			tab.setAttribute( 'aria-expanded', String( ! bar.hidden ) );
			fitMonth( cal );
		} );
		views.parentNode.insertBefore( tab, views.nextSibling );
		// One dropdown open at a time; a click elsewhere or Escape closes it.
		document.addEventListener( 'click', function ( e ) {
			bar.querySelectorAll( '.pd-cal-menu[open]' ).forEach( function ( menu ) { if ( ! menu.contains( e.target ) ) { menu.open = false; } } );
		} );
		document.addEventListener( 'keydown', function ( e ) {
			if ( e.key !== 'Escape' ) { return; }
			bar.querySelectorAll( '.pd-cal-menu[open]' ).forEach( function ( menu ) { menu.open = false; menu.querySelector( 'summary' ).focus(); } );
		} );
	}

	/** The views (Month, Week, Agenda) and the week steps. */
	function buildControls( cal, today ) {
		var weeks = Array.prototype.slice.call( cal.querySelectorAll( '.pd-cal-wk' ) ), shown = 0;
		weeks.forEach( function ( w, i ) { if ( w.querySelector( '[data-date="' + today + '"]' ) ) { shown = i; } } );
		var showWeek = function () { weeks.forEach( function ( w, i ) { w.classList.toggle( 'is-week', i === shown ); } ); };
		var views = cal.querySelector( '[data-pd-views]' );
		// The view a reader picks (never the default) follows them to the next month, for this visit.
		var kept = null;
		try { kept = window.sessionStorage.getItem( 'pd-cal-view' ); } catch {}
		var setView = function ( v, picked ) {
			cal.setAttribute( 'data-view', v );
			if ( picked ) { try { window.sessionStorage.setItem( 'pd-cal-view', v ); } catch {} }
			if ( views ) { views.querySelectorAll( '[data-v]' ).forEach( function ( b ) { b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-v' ) === v ) ); } ); }
			fitMonth( cal );
		};
		if ( views ) {
			[ [ 'month', 'Month' ], [ 'week', 'Week' ], [ 'agenda', 'Agenda' ] ].forEach( function ( v ) {
				var b = document.createElement( 'button' );
				b.type = 'button';
				b.setAttribute( 'data-v', v[ 0 ] );
				b.textContent = v[ 1 ];
				b.addEventListener( 'click', function () { setView( v[ 0 ], true ); } );
				views.appendChild( b );
			} );
			[ [ -1, '‹', 'Earlier week' ], [ 1, '›', 'Later week' ] ].forEach( function ( step ) {
				var b = document.createElement( 'button' );
				b.type = 'button';
				b.className = 'pd-cal-wstep';
				b.textContent = step[ 1 ];
				b.setAttribute( 'aria-label', step[ 2 ] );
				b.addEventListener( 'click', function () { shown = Math.min( weeks.length - 1, Math.max( 0, shown + step[ 0 ] ) ); showWeek(); } );
				views.appendChild( b );
			} );
		}
		// Month view shows the events; a click on a week opens it with every session.
		weeks.forEach( function ( w, i ) {
			w.addEventListener( 'click', function () {
				if ( cal.getAttribute( 'data-view' ) !== 'month' ) { return; }
				shown = i;
				showWeek();
				setView( 'week', true );
			} );
		} );
		showWeek();
		setView( /^(month|week|agenda)$/.test( kept || '' ) ? kept : window.matchMedia && window.matchMedia( '(max-width: 699px)' ).matches ? 'agenda' : 'month' );
	}

	function setupCalendar( cal ) {
		cal.querySelectorAll( '.pd-cs[data-utc]' ).forEach( function ( item ) {
			var t = Date.parse( item.getAttribute( 'data-utc' ) );
			var cell = isFinite( t ) && cal.querySelector( '.pd-cal-ses[data-date="' + isoDay( t ) + '"]' );
			if ( cell ) { cell.appendChild( item ); } else { item.remove(); }
		} );
		cal.querySelectorAll( '.pd-cal-ses' ).forEach( function ( cell ) {
			Array.prototype.slice.call( cell.querySelectorAll( '.pd-cs' ) ).sort( byStart ).forEach( function ( item ) { cell.appendChild( item ); } );
		} );
		var spill = cal.querySelector( '.pd-cal-spill' );
		if ( spill ) { spill.remove(); }
		cal.querySelectorAll( '.pd-wc' ).forEach( regroupCard );
		cal.querySelectorAll( '[data-pd-zonename]' ).forEach( function ( el ) { el.textContent = 'your time'; } );
		cal.querySelectorAll( '[data-pd-calzone]' ).forEach( function ( el ) { el.textContent = 'Times in your zone: ' + zone.split( '/' ).pop().replace( /_/g, ' ' ); } );
		clockNote( cal );
		buildControls( cal, isoDay( nowAt() ) );
		buildFilters( cal );
		applyFilter( cal );
	}

	/** Live now, Next and Final on a card's sessions, and its Live pill. */
	function cardStates( card, now ) {
		var items = Array.prototype.slice.call( card.querySelectorAll( '.pd-wc-s' ) );
		var span = function ( s ) { var a = Date.parse( s.getAttribute( 'data-utc' ) ); return [ a, Date.parse( s.getAttribute( 'data-end' ) ) || a ]; };
		var live = items.filter( function ( s ) { var t = span( s ); return now >= t[ 0 ] && now < t[ 1 ]; } )[ 0 ] || null;
		// Once the weekend is under way, the first session still to come (and not filtered out) is Next.
		var begun = live || items.some( function ( s ) { return span( s )[ 1 ] <= now; } );
		var next = begun ? items.filter( function ( s ) { return span( s )[ 0 ] > now && ! s.classList.contains( 'is-filtered' ); } )[ 0 ] || null : null;
		items.forEach( function ( s ) {
			var clock = s.querySelector( '.pd-t' ), old = s.querySelector( 'em' );
			var state = s === live ? 'live' : s === next ? 'next' : span( s )[ 1 ] <= now ? 'done' : '';
			if ( old ) { old.remove(); }
			s.classList.remove( 'is-live', 'is-next', 'is-done' );
			if ( clock ) { clock.hidden = state !== ''; }
			if ( ! state ) { return; }
			var em = document.createElement( 'em' );
			em.textContent = state === 'live' ? 'Live now' : state === 'done' ? 'Final' : 'Next · ' + ( clock ? clock.textContent : '' );
			s.classList.add( 'is-' + state );
			s.appendChild( em );
		} );
		var band = card.querySelector( '.pd-wc-band' ), pill = band && band.querySelector( '.pd-pill' );
		if ( band && live && ! pill ) {
			pill = document.createElement( 'i' );
			pill.className = 'pd-pill pd-pill-live';
			pill.textContent = '● Live';
			band.appendChild( pill );
		}
		if ( pill && ! live ) { pill.remove(); }
	}

	/** Today boxed, the past greyed, This weekend and Next weekend named, past weekends folded behind one button. */
	function calendarStates( cal, now, today ) {
		cal.querySelectorAll( '.pd-cal-dn, .pd-cal-bg, .pd-cal-ses' ).forEach( function ( el ) {
			var d = el.getAttribute( 'data-date' );
			el.classList.toggle( 'is-past', d < today );
			el.classList.toggle( 'is-today', d === today );
		} );
		cal.querySelectorAll( '.pd-cal-band' ).forEach( function ( el ) { el.classList.toggle( 'is-past', el.getAttribute( 'data-to' ) < today ); } );
		cal.querySelectorAll( '.pd-cs' ).forEach( function ( el ) { el.classList.toggle( 'is-done', Date.parse( el.getAttribute( 'data-end' ) ) <= now ); } );
		cal.querySelectorAll( '.pd-wc' ).forEach( function ( card ) { cardStates( card, now ); } );
		var day = new Date( today + 'T00:00:00Z' );
		var fri = new Date( day.getTime() + ( 4 - ( day.getUTCDay() + 6 ) % 7 ) * 864e5 ).toISOString().slice( 0, 10 );
		var nextFri = new Date( Date.parse( fri + 'T00:00:00Z' ) + 7 * 864e5 ).toISOString().slice( 0, 10 );
		var weekends = cal.querySelectorAll( '.pd-cal-wkend' ), past = 0, shown = 0;
		weekends.forEach( function ( wk ) {
			var head = wk.querySelector( '.pd-cal-wkh span' ), count = wk.querySelector( '.pd-cal-wkh small' );
			if ( ! head || ! count ) { return; }
			if ( ! head.hasAttribute( 'data-dates' ) ) { head.setAttribute( 'data-dates', head.textContent ); }
			var from = wk.getAttribute( 'data-from' ), name = from === fri ? 'This weekend' : from === nextFri ? 'Next weekend' : '';
			var n = wk.querySelectorAll( '.pd-wc:not(.is-filtered)' ).length;
			head.textContent = name || head.getAttribute( 'data-dates' );
			count.textContent = ( name ? head.getAttribute( 'data-dates' ) + ' · ' : '' ) + n + ' event' + ( n === 1 ? '' : 's' );
			var gone = wk.getAttribute( 'data-to' ) < today;
			wk.classList.toggle( 'is-past', gone );
			if ( wk.classList.contains( 'is-filtered' ) ) { return; }
			shown++;
			if ( gone ) { past++; }
		} );
		// Past weekends open on the button, or by themselves while every weekend in view is past; the filters can undo the second.
		var agenda = cal.querySelector( '.pd-cal-agenda' ), button = agenda && agenda.querySelector( '.pd-cal-earlier' );
		cal.classList.toggle( 'is-earlier', cal.hasAttribute( 'data-earlier' ) || ( past > 0 && past === shown ) );
		if ( agenda && past && ! button ) {
			button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'pd-cal-earlier';
			button.addEventListener( 'click', function () { cal.setAttribute( 'data-earlier', '' ); cal.classList.add( 'is-earlier' ); button.hidden = true; } );
			agenda.insertBefore( button, agenda.firstChild );
		}
		if ( button ) {
			button.hidden = ! past || cal.classList.contains( 'is-earlier' );
			button.textContent = 'Show ' + past + ' earlier weekend' + ( past === 1 ? '' : 's' );
		}
	}

	document.querySelectorAll( '.pd-cal' ).forEach( setupCalendar );
	var refit = 0;
	window.addEventListener( 'resize', function () {
		if ( refit ) { return; }
		refit = window.requestAnimationFrame( function () { refit = 0; document.querySelectorAll( '.pd-cal' ).forEach( fitMonth ); } );
	} );
	// Archivo arriving can move the grid's top by a few pixels, so the month is fitted again once the fonts are in.
	if ( document.fonts && document.fonts.ready ) { document.fonts.ready.then( function () { document.querySelectorAll( '.pd-cal' ).forEach( fitMonth ); } ); }
	render();
	if ( ! frozen ) { setInterval( render, 30000 ); }

	// The phone search: focus the field when it opens, close it on Escape.
	document.querySelectorAll( 'details.pd-search-sm' ).forEach( function ( d ) {
		var input = d.querySelector( 'input' ), summary = d.querySelector( 'summary' );
		d.addEventListener( 'toggle', function () { if ( d.open && input ) { input.focus(); } } );
		d.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' && d.open ) {
				d.open = false;
				if ( summary ) { summary.focus(); }
			}
		} );
	} );

	var here = location.pathname.replace( /\/+$/, '/' );
	document.querySelectorAll( '.pd-tabs a, .pd-nav a' ).forEach( function ( a ) {
		var path = new URL( a.href, location.href ).pathname;
		if ( path === here || ( path !== '/' && here.indexOf( path ) === 0 ) ) { a.setAttribute( 'aria-current', 'page' ); }
	} );
}() );
