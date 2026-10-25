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

	/** A weekend's strip (O19): the countdown runs to the next session's start, and Next shows while one is still to
	 *  come; the [data-pd-ses] pass in render() names the session, or the one on now with its Live pill. */
	function weekendStrips( now ) {
		document.querySelectorAll( '.pd-wk-nx[data-pd-ses]' ).forEach( function ( strip ) {
			var list = strip.getAttribute( 'data-pd-ses' ).split( ';' ).map( function ( s ) {
				var p = s.split( '|' ), a = Date.parse( p[ 1 ] );
				return { start: a, end: Date.parse( p[ 2 ] ) || a };
			} ).filter( function ( s ) { return isFinite( s.start ); } );
			var live = list.some( function ( s ) { return now >= s.start && now < s.end; } );
			var next = live ? null : list.filter( function ( s ) { return s.start > now; } )[ 0 ] || null;
			var count = strip.querySelector( '[data-pd-target]' ), pill = strip.querySelector( '.pd-wk-pill' );
			if ( count ) { count.setAttribute( 'data-pd-target', next ? new Date( next.start ).toISOString() : '' ); }
			if ( pill ) { pill.hidden = ! next; }
		} );
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

		weekendStrips( now );
		// A track's zone beside the reader's (O19): its offset in minutes east of UTC against the reader's own, both at the
		// weekend's first session (data-pd-at), so a change of clocks between today and the weekend is counted.
		document.querySelectorAll( '[data-pd-ahead]' ).forEach( function ( el ) {
			var at = Date.parse( el.getAttribute( 'data-pd-at' ) || '' );
			var diff = Number( el.getAttribute( 'data-pd-ahead' ) ) + new Date( isFinite( at ) ? at : now ).getTimezoneOffset();
			if ( ! isFinite( diff ) ) { return; }
			var a = Math.abs( diff ), h = Math.floor( a / 60 ), m = a % 60;
			var span = ( h ? h + ' h' : '' ) + ( m ? ( h ? ' ' : '' ) + m + ' min' : '' );
			el.textContent = diff === 0 ? ' · the same as yours' : ' · ' + span + ( diff > 0 ? ' ahead of' : ' behind' ) + ' you';
		} );

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

		// The series pages (O13): a round's label while the reader's own date is within its dates, and the round
		// card's session on now or next ("Practice 1 · on now"), with its Live pill; the race is named once.
		var day = isoDay( now );
		document.querySelectorAll( '.pd-wk[data-from][data-to][data-on]' ).forEach( function ( el ) {
			if ( ! el.hasAttribute( 'data-off' ) ) { el.setAttribute( 'data-off', el.textContent ); }
			var on = day >= el.getAttribute( 'data-from' ) && day <= el.getAttribute( 'data-to' );
			el.textContent = el.getAttribute( on ? 'data-on' : 'data-off' );
			el.classList.toggle( 'is-on', on );
		} );
		// The series list (O22): the days until a round's first day by the reader's own date, beside its Next; nothing
		// once its weekend is on, when the pill reads This weekend. Whole days, counted between two calendar dates.
		var dayNo = function ( iso ) { var p = iso.split( '-' ); return Date.UTC( +p[ 0 ], p[ 1 ] - 1, +p[ 2 ] ) / 864e5; };
		document.querySelectorAll( '[data-pd-days]' ).forEach( function ( el ) {
			var n = dayNo( el.getAttribute( 'data-pd-days' ) ) - dayNo( day );
			el.textContent = n === 1 ? 'tomorrow' : 'in ' + n + ' days';
			// `! ( n >= 1 )` and not `n < 1`: a date the arithmetic cannot read (NaN) stays hidden too.
			el.hidden = ! ( n >= 1 ) || !! el.parentNode.querySelector( '.pd-wk.is-on' );
		} );
		document.querySelectorAll( '[data-pd-ses]' ).forEach( function ( card ) {
			var list = card.getAttribute( 'data-pd-ses' ).split( ';' ).map( function ( s ) {
				var p = s.split( '|' ), a = Date.parse( p[ 1 ] ), name = p[ 0 ];
				// The publisher URI-encodes each name (O15); a page published before then carries them plain.
				try { name = decodeURIComponent( name ); } catch { /* plain */ }
				return { name: name, start: a, end: Date.parse( p[ 2 ] ) || a };
			} ).filter( function ( s ) { return isFinite( s.start ); } );
			var live = list.filter( function ( s ) { return now >= s.start && now < s.end; } )[ 0 ] || null;
			var next = live ? null : list.filter( function ( s ) { return s.start > now; } )[ 0 ] || null;
			var shown = live || next, last = list[ list.length - 1 ];
			var pill = card.querySelector( '.pd-pill-live' ), ses = card.querySelector( '.pd-sr-ses' ), race = card.querySelector( '.pd-sr-race' );
			if ( pill ) { pill.hidden = ! live; }
			// A weekend's strip (O19) between its last session's end and the publisher's next run, which writes Final.
			var over = card.classList.contains( 'pd-wk-nx' ) ? 'Every session has run · the results follow' : '';
			if ( ses ) { ses.textContent = ! shown ? over : live ? live.name + ' · on now' : next.name + ' · ' + fWd.format( new Date( next.start ) ) + ' ' + fT.format( new Date( next.start ) ); }
			if ( race ) { race.hidden = !! shown && shown === last; }
		} );
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
	 *  share the screen's height under the pinned bar (the operator, 22 Oct: the headline scrolls away once and every
	 *  event shows; until then the month fitted the window under the whole headline), at 24px a day row and 19px a band
	 *  row as style.css draws them, and a week with more events than fit says "+N more" on the days it hides; a click
	 *  opens the week. Week view takes as many 23px band rows as the packing needs, the sessions below them. */
	function fitMonth( cal ) {
		var grid = cal.querySelector( '.pd-cal-grid' ), weeks = cal.querySelectorAll( '.pd-cal-wk' ), fit = 99;
		var month = cal.getAttribute( 'data-view' ) === 'month';
		cal.querySelectorAll( '.pd-cal-over' ).forEach( function ( el ) { el.remove(); } );
		if ( ! grid || ! weeks.length ) { return; }
		if ( month ) {
			var dow = grid.querySelector( '.pd-cal-dow' );
			// The pinned bar's height (style.css) and WordPress's own bar above it, when a reader is signed in.
			var bars = ( parseFloat( getComputedStyle( cal ).getPropertyValue( '--pd-cal-bar' ) ) || 0 ) + ( parseFloat( getComputedStyle( document.documentElement ).getPropertyValue( '--wp-admin--admin-bar--height' ) ) || 0 );
			var room = window.innerHeight - bars - ( dow ? dow.offsetHeight : 0 ) - 12;
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
		// A series page's Calendar tab (/calendar/#f1) shows that series alone for the visit; the reader's own Filters stay as they were.
		var visit = cal.getAttribute( 'data-visit' );
		var offSeries = visit ? ( cal.pdSeries || [] ).filter( function ( s ) { return s !== visit; } ) : hiddenOf( 'pd-off-series' ), offKinds = hiddenOf( 'pd-off-kinds' );
		// The Series dropdown shows what the page shows: a visit's one series, otherwise the reader's own.
		cal.querySelectorAll( '.pd-cal-menu.is-series input' ).forEach( function ( box ) { box.checked = offSeries.indexOf( box.value ) < 0; } );
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
		if ( tab ) { tab.textContent = visit ? 'Filters · ' + cal.pdShort[ visit ] + ' only' : count ? 'Filters · ' + count : 'Filters'; }
		fitMonth( cal );
		calendarStates( cal, nowAt(), isoDay( nowAt() ) );
	}

	/** The visit's one series: a notice with Show every series, and the month arrows and Today keeping it. */
	function startVisit( cal, slug ) {
		cal.setAttribute( 'data-visit', slug );
		var note = document.createElement( 'p' ), what = document.createElement( 'b' ), why = document.createElement( 'span' ), all = document.createElement( 'button' );
		note.className = 'pd-cal-only pd-s-' + slug;
		what.textContent = cal.pdName[ slug ] + ' only';
		why.textContent = 'because you came from the ' + cal.pdName[ slug ] + ' page, until you leave the Calendar';
		all.type = 'button';
		all.textContent = 'Show every series';
		// The button goes with the notice, so the keyboard's place moves to Filters.
		all.addEventListener( 'click', function () {
			endVisit( cal );
			applyFilter( cal );
			var tab = cal.querySelector( '.pd-cal-ftab' );
			if ( tab ) { tab.focus(); }
		} );
		note.appendChild( what );
		note.appendChild( why );
		note.appendChild( all );
		var top = cal.querySelector( '.pd-cal-top' );
		if ( top ) { top.parentNode.insertBefore( note, top.nextSibling ); }
		cal.querySelectorAll( 'a.pd-cal-step, a.pd-cal-today' ).forEach( function ( a ) { a.setAttribute( 'href', a.getAttribute( 'href' ).split( '#' )[ 0 ] + '#' + slug ); } );
	}

	function endVisit( cal ) {
		if ( ! cal.hasAttribute( 'data-visit' ) ) { return; }
		cal.removeAttribute( 'data-visit' );
		var note = cal.querySelector( '.pd-cal-only' );
		if ( note ) { note.remove(); }
		cal.querySelectorAll( 'a.pd-cal-step, a.pd-cal-today' ).forEach( function ( a ) { a.setAttribute( 'href', a.getAttribute( 'href' ).split( '#' )[ 0 ] ); } );
		try { history.replaceState( null, '', location.pathname + location.search ); } catch {}
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
			box.value = item[ 0 ];
			box.checked = hiddenOf( key ).indexOf( item[ 0 ] ) < 0;
			if ( item[ 2 ] ) { label.className = item[ 2 ]; }
			box.addEventListener( 'change', function () {
				// What the boxes show becomes the reader's own (during a visit, the visit's one series and this change); a
				// series not in this dropdown keeps its stored state.
				var off = hiddenOf( key ).filter( function ( s ) { return ! items.some( function ( i ) { return i[ 0 ] === s; } ); } );
				boxes.forEach( function ( b ) { if ( ! b.checked ) { off.push( b.value ); } } );
				calStore.set( key, off.join( ',' ) );
				// Picking series by hand ends a series page's visit filter: the reader's own choice takes over.
				if ( key === 'pd-off-series' ) { endVisit( cal ); }
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
				if ( key === 'pd-off-series' ) { endVisit( cal ); }
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

	/** The pinned bar (the operator, 22 Oct: "A with C"): once the month's steps have scrolled off the top of the screen, a
	 *  slim bar holds them, the month's name and Today, and goes again when they come back. A plain block, so the page
	 *  keeps one Months landmark. */
	function pinBar( cal ) {
		var top = cal.querySelector( '.pd-cal-top' ), nav = top && top.querySelector( '.pd-cal-month' ), h1 = top && top.querySelector( '.pd-cal-h1' );
		if ( ! nav || ! h1 || ! ( 'IntersectionObserver' in window ) ) { return; }
		var bar = document.createElement( 'div' ), name = document.createElement( 'b' );
		var prev = nav.querySelector( '[rel="prev"]' ), next = nav.querySelector( '[rel="next"]' ), today = top.querySelector( '.pd-cal-today' );
		bar.className = 'pd-cal-bar';
		bar.hidden = true;
		Array.prototype.forEach.call( h1.childNodes, function ( n ) { if ( n.nodeName !== 'SMALL' ) { name.appendChild( n.cloneNode( true ) ); } } );
		[ prev, name, next, today ].forEach( function ( el ) { if ( el ) { bar.appendChild( el === name ? el : el.cloneNode( true ) ); } } );
		top.parentNode.insertBefore( bar, top.nextSibling );
		// Signed in, WordPress's own bar covers the top of the screen above 600 px: the steps are gone once under it.
		var wp = window.innerWidth > 600 ? parseFloat( getComputedStyle( document.documentElement ).getPropertyValue( '--wp-admin--admin-bar--height' ) ) || 0 : 0;
		new IntersectionObserver( function ( entries ) {
			var last = entries[ entries.length - 1 ], gone = ! last.isIntersecting && last.boundingClientRect.top < wp;
			bar.hidden = ! gone;
			cal.classList.toggle( 'is-pinned', gone );
		}, { rootMargin: '-' + wp + 'px 0px 0px 0px' } ).observe( nav );
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
		// The published chips name every series on the page; a series page's Calendar tab asks for one by its slug.
		cal.pdSeries = [];
		cal.pdShort = {};
		cal.pdName = {};
		cal.querySelectorAll( '.pd-cal-chip[data-s]' ).forEach( function ( chip ) {
			var s = chip.getAttribute( 'data-s' );
			cal.pdSeries.push( s );
			cal.pdShort[ s ] = chip.textContent;
			cal.pdName[ s ] = chip.getAttribute( 'data-name' ) || chip.textContent;
		} );
		buildFilters( cal );
		pinBar( cal );
		var asked = location.hash.slice( 1 );
		if ( cal.pdSeries.indexOf( asked ) >= 0 ) { startVisit( cal, asked ); }
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
		// Race week (the operator, 21 Oct): the week holding today when it has a race weekend of a series on show, otherwise the
		// next week on this page that has one, in Paddock's yellow; on the agenda the tag heads that week's weekend. Only the
		// month whose grid holds today has one: a month further on would otherwise tint its own first race weekend.
		var race = null, holds = cal.querySelector( '.pd-cal-dn[data-date="' + today + '"]' ) !== null;
		cal.querySelectorAll( '.pd-cal-wk' ).forEach( function ( w ) {
			var days = w.querySelectorAll( '.pd-cal-dn[data-date]' ), last = days.length ? days[ days.length - 1 ].getAttribute( 'data-date' ) : '';
			var on = holds && ! race && last >= today && Array.prototype.some.call( w.querySelectorAll( '.pd-cal-band:not(.is-filtered)' ), function ( b ) { return b.getAttribute( 'data-to' ) >= today; } );
			if ( on ) { race = { first: days[ 0 ].getAttribute( 'data-date' ), last: last }; }
			w.classList.toggle( 'is-race', on );
			if ( on && ! w.querySelector( '.pd-cal-rw' ) ) {
				var tag = document.createElement( 'span' );
				tag.className = 'pd-cal-rw';
				tag.textContent = 'Race week';
				w.appendChild( tag );
			}
		} );
		weekends.forEach( function ( wk ) {
			var from = wk.getAttribute( 'data-from' ), on = race !== null && from >= race.first && from <= race.last, head = wk.querySelector( '.pd-cal-wkh' );
			wk.classList.toggle( 'is-race', on );
			if ( on && head && ! head.querySelector( '.pd-cal-rw' ) ) {
				var tag = document.createElement( 'em' );
				tag.className = 'pd-cal-rw';
				tag.textContent = 'Race week';
				head.insertBefore( tag, head.firstChild );
			}
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

	// Follow (O13): the series a reader follows, kept in this browser; the button shows only with the script.
	var followed = function () { return ( calStore.get( 'pd-follow' ) || '' ).split( ',' ).filter( Boolean ); };
	document.querySelectorAll( 'button[data-pd-follow]' ).forEach( function ( b ) {
		var slug = b.getAttribute( 'data-pd-follow' );
		var show = function () {
			var on = followed().indexOf( slug ) >= 0;
			// A card's + (the series list) names its own two states.
			b.textContent = on ? b.getAttribute( 'data-on' ) || 'Following ✓' : b.getAttribute( 'data-off' ) || 'Follow';
			b.setAttribute( 'aria-pressed', String( on ) );
		};
		b.addEventListener( 'click', function () {
			var list = followed(), at = list.indexOf( slug );
			if ( at >= 0 ) { list.splice( at, 1 ); } else { list.push( slug ); }
			calStore.set( 'pd-follow', list.join( ',' ) );
			document.dispatchEvent( new CustomEvent( 'pd-follow' ) );
			show();
		} );
		b.hidden = false;
		show();
	} );

	// Pit wall (O19): a stint's laps and its pit lap on hover or keyboard focus; a tap keeps it open on a phone.
	// WordPress keeps no tabindex in a page, so each stint gets its keyboard stop here.
	document.querySelectorAll( '.pd-pw' ).forEach( function ( pw ) {
		var tip = pw.querySelector( '.pd-pw-tip' ), pinned = null;
		if ( ! tip ) { return; }
		var show = function ( el ) {
			tip.textContent = el.getAttribute( 'data-tip' );
			tip.hidden = false;
			var r = el.getBoundingClientRect(), b = pw.getBoundingClientRect(), w = tip.offsetWidth / 2;
			tip.style.left = Math.min( Math.max( r.left + r.width / 2 - b.left, w + 4 ), b.width - w - 4 ) + 'px';
			tip.style.top = ( r.top - b.top ) + 'px';
		};
		// Leaving a stint while another is pinned shows the pinned one again; Escape closes the tip (WCAG 1.4.13).
		var hide = function () { if ( pinned ) { show( pinned ); } else { tip.hidden = true; } };
		pw.addEventListener( 'keydown', function ( ev ) { if ( ev.key === 'Escape' ) { pinned = null; tip.hidden = true; } } );
		pw.querySelectorAll( '.pd-pw-bar i[data-tip]' ).forEach( function ( el ) {
			el.tabIndex = 0;
			el.addEventListener( 'mouseenter', function () { show( el ); } );
			el.addEventListener( 'mouseleave', hide );
			el.addEventListener( 'focus', function () { show( el ); } );
			el.addEventListener( 'blur', function () { pinned = null; hide(); } );
			el.addEventListener( 'click', function () {
				pinned = pinned === el ? null : el;
				if ( pinned ) { show( el ); } else { tip.hidden = true; }
			} );
		} );
	} );

	// The circuit (O19): a pole lap's points as the publisher stores them in data-pd-map (its box, the points where
	// sectors 2 and 3 begin, then x,y pairs, north up). WordPress keeps no SVG in a page, so it is drawn here: the three
	// sectors, their ticks, the start/finish line, the way the cars run, and each sector's number.
	var SVG = 'http://www.w3.org/2000/svg';
	document.querySelectorAll( '.pd-cm-draw[data-pd-map]' ).forEach( function ( box ) {
		var parts = box.getAttribute( 'data-pd-map' ).split( '|' );
		if ( parts.length !== 3 ) { return; }
		var size = parts[ 0 ].split( ' ' ).map( Number ), split = parts[ 1 ].split( ' ' ).map( Number );
		var pts = parts[ 2 ].split( ' ' ).map( function ( p ) { return p.split( ',' ).map( Number ); } ).filter( function ( p ) { return isFinite( p[ 0 ] ) && isFinite( p[ 1 ] ); } );
		if ( pts.length < 50 || ! ( split[ 0 ] > 0 && split[ 1 ] > split[ 0 ] && split[ 1 ] < pts.length - 1 ) ) { return; }
		var r1 = function ( v ) { return v.toFixed( 1 ); };
		var node = function ( tag, attrs, text ) {
			var n = document.createElementNS( SVG, tag );
			Object.keys( attrs ).forEach( function ( k ) { n.setAttribute( k, attrs[ k ] ); } );
			if ( text ) { n.textContent = text; }
			return n;
		};
		var path = function ( a, b ) { return pts.slice( a, b + 1 ).map( function ( p, j ) { return ( j ? 'L' : 'M' ) + r1( p[ 0 ] ) + ',' + r1( p[ 1 ] ); } ).join( '' ); };
		var dir = function ( i ) {
			var a = pts[ Math.max( i - 2, 0 ) ], b = pts[ Math.min( i + 2, pts.length - 1 ) ], dx = b[ 0 ] - a[ 0 ], dy = b[ 1 ] - a[ 1 ], l = Math.hypot( dx, dy ) || 1;
			return [ dx / l, dy / l ];
		};
		var across = function ( i, len, cls ) {
			var p = pts[ i ], d = dir( i );
			return node( 'line', { 'class': cls, x1: r1( p[ 0 ] - d[ 1 ] * len ), y1: r1( p[ 1 ] + d[ 0 ] * len ), x2: r1( p[ 0 ] + d[ 1 ] * len ), y2: r1( p[ 1 ] - d[ 0 ] * len ) } );
		};
		var last = pts.length - 1, s = pts[ 0 ];
		var svg = node( 'svg', { viewBox: '-40 -40 ' + ( size[ 0 ] + 80 ) + ' ' + ( size[ 1 ] + 80 ), 'aria-hidden': 'true', focusable: 'false' } );
		var s1 = path( 0, split[ 0 ] ), s2 = path( split[ 0 ], split[ 1 ] ), s3 = path( split[ 1 ], last ) + 'L' + r1( s[ 0 ] ) + ',' + r1( s[ 1 ] );
		svg.appendChild( node( 'path', { 'class': 'pd-cm-under', d: s1 + s2.replace( /^M/, 'L' ) + s3.replace( /^M/, 'L' ) } ) );
		[ s1, s2, s3 ].forEach( function ( d, k ) { svg.appendChild( node( 'path', { 'class': 'pd-cm-s pd-cm-s' + ( k + 1 ), d: d } ) ); } );
		svg.appendChild( across( split[ 0 ], 17, 'pd-cm-tick' ) );
		svg.appendChild( across( split[ 1 ], 17, 'pd-cm-tick' ) );
		svg.appendChild( across( 0, 26, 'pd-cm-sf' ) );
		svg.appendChild( across( 0, 26, 'pd-cm-sf2' ) );
		var ia = Math.min( 9, last ), a = pts[ ia ], ad = dir( ia );
		var tri = [ [ a[ 0 ] + ad[ 0 ] * 15, a[ 1 ] + ad[ 1 ] * 15 ], [ a[ 0 ] - ad[ 0 ] * 9 - ad[ 1 ] * 10, a[ 1 ] - ad[ 1 ] * 9 + ad[ 0 ] * 10 ], [ a[ 0 ] - ad[ 0 ] * 9 + ad[ 1 ] * 10, a[ 1 ] - ad[ 1 ] * 9 - ad[ 0 ] * 10 ] ];
		svg.appendChild( node( 'polygon', { 'class': 'pd-cm-ar', points: tri.map( function ( q ) { return r1( q[ 0 ] ) + ',' + r1( q[ 1 ] ); } ).join( ' ' ) } ) );
		var badges = [ [ 0, split[ 0 ] ], [ split[ 0 ], split[ 1 ] ], [ split[ 1 ], last ] ].map( function ( range, k ) {
			var i = Math.round( ( range[ 0 ] + range[ 1 ] ) / 2 ), g = svg.appendChild( node( 'g', { 'class': 'pd-cm-badge' } ) );
			return { p: pts[ i ], d: dir( i ), c: g.appendChild( node( 'circle', { 'class': 'pd-cm-k' + ( k + 1 ) } ) ), t: g.appendChild( node( 'text', {}, String( k + 1 ) ) ) };
		} );
		var d0 = dir( 0 ), lbl = svg.appendChild( node( 'text', { 'class': 'pd-cm-lbl' }, 'Start / finish' ) );
		box.appendChild( svg );
		// Drawn in the map's own units, the badges and the label would shrink with the drawing (to about 5 px on a phone):
		// k grows them so that a badge is never under 11 px across on the screen, whatever the screen or the track's shape.
		var fit = function () {
			var r = svg.getBoundingClientRect();
			if ( ! ( r.width > 0 && r.height > 0 ) ) { return; }
			var k = Math.max( 1, 11 * Math.max( ( size[ 0 ] + 80 ) / r.width, ( size[ 1 ] + 80 ) / r.height ) / 16 );
			badges.forEach( function ( b ) {
				var cx = r1( b.p[ 0 ] - b.d[ 1 ] * 34 * k ), cy = r1( b.p[ 1 ] + b.d[ 0 ] * 34 * k );
				b.c.setAttribute( 'cx', cx );
				b.c.setAttribute( 'cy', cy );
				b.c.setAttribute( 'r', r1( 16 * k ) );
				b.t.setAttribute( 'x', cx );
				b.t.setAttribute( 'y', cy );
				b.t.style.fontSize = r1( 17 * k ) + 'px';
			} );
			var lx = s[ 0 ] + d0[ 1 ] * 40 * k;
			lbl.setAttribute( 'x', r1( lx ) );
			lbl.setAttribute( 'y', r1( s[ 1 ] - d0[ 0 ] * 40 * k + 6 * k ) );
			lbl.setAttribute( 'text-anchor', lx > size[ 0 ] - 220 * k ? 'end' : lx < 220 * k ? 'start' : 'middle' );
			lbl.style.fontSize = r1( 16 * k ) + 'px';
			lbl.style.strokeWidth = r1( 6 * k ) + 'px';
		};
		fit();
		if ( window.ResizeObserver ) { new ResizeObserver( fit ).observe( box ); } else { window.addEventListener( 'resize', fit ); }
	} );

	// The title race (O29): the top three's points after every round as the publisher stores them in data-pd-race (the
	// rounds; the turning points' rounds; each driver: code, surname, colour, dashed, his totals; each round: its short
	// name, day, winner, its leader as one of the three or by name, the leader's points). Drawn here, as WordPress keeps
	// no SVG in a page: the points behind the leader or the points themselves (the switch), the leader's run as a bar,
	// the turning points numbered as told below, each line's end labelled and the runner-up's furthest point marked. A
	// pointer, a tap or the arrow keys read a round's standings in the readout; Escape lets go. In Night a line under 3:1
	// against the box is lightened until it reaches it (the operator, 25 Oct: Red Bull's navy). Drawn again when the
	// width or the scheme changes. Without the script the table under it stands open.
	document.querySelectorAll( '.pd-tr-chart' ).forEach( function ( card ) {
		var box = card.querySelector( '.pd-tr-draw[data-pd-race]' ), read = card.querySelector( '.pd-tr-read' ), seg = card.querySelector( '.pd-tr-seg' );
		if ( ! box || ! read ) { return; }
		var parts = box.getAttribute( 'data-pd-race' ).split( '|' );
		if ( parts.length !== 4 ) { return; }
		var N = Number( parts[ 0 ] ), turns = parts[ 1 ] ? parts[ 1 ].split( ' ' ).map( Number ) : [];
		var D = parts[ 2 ].split( ';' ).map( function ( s ) {
			var f = s.split( '~' );
			return { code: f[ 0 ], name: f[ 1 ], colour: f[ 2 ], dashed: f[ 3 ] === '1', p: ( f[ 4 ] || '' ).split( ',' ).map( Number ) };
		} );
		var R = parts[ 3 ].split( ';' ).map( function ( s ) {
			var f = s.split( '~' );
			return { name: f[ 0 ], day: f[ 1 ], win: f[ 2 ], leader: /^\d$/.test( f[ 3 ] ) ? D[ Number( f[ 3 ] ) ] : null, other: f[ 3 ], lead: Number( f[ 4 ] ) };
		} );
		if ( ! ( N > 1 ) || R.length !== N || D.length !== 3 || D.some( function ( d ) { return d.p.length !== N || d.p.some( isNaN ); } ) ) { return; }
		var view = 'gap', at = null, pinned = false, compact = false, show = function () {};
		var night = window.matchMedia( '(prefers-color-scheme: dark)' );
		var node = function ( tag, attrs, parent, text ) {
			var n = document.createElementNS( SVG, tag );
			Object.keys( attrs ).forEach( function ( k ) { n.setAttribute( k, attrs[ k ] ); } );
			if ( text !== undefined ) { n.textContent = text; }
			if ( parent ) { parent.appendChild( n ); }
			return n;
		};
		// Colours as [ r, g, b ]; contrast as WCAG reckons it.
		var rgb = function ( s ) {
			var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec( s );
			if ( m ) {
				var h = m[ 1 ].length === 3 ? m[ 1 ].replace( /(.)/g, '$1$1' ) : m[ 1 ];
				return [ 0, 2, 4 ].map( function ( i ) { return parseInt( h.slice( i, i + 2 ), 16 ); } );
			}
			var v = String( s ).match( /\d+/g );
			return v && v.length >= 3 ? v.slice( 0, 3 ).map( Number ) : [ 154, 163, 178 ];
		};
		var lum = function ( c ) {
			var v = c.map( function ( x ) { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow( ( x + 0.055 ) / 1.055, 2.4 ); } );
			return 0.2126 * v[ 0 ] + 0.7152 * v[ 1 ] + 0.0722 * v[ 2 ];
		};
		var ratio = function ( a, b ) { var x = lum( a ), y = lum( b ); return ( Math.max( x, y ) + 0.05 ) / ( Math.min( x, y ) + 0.05 ); };
		var css = function ( c ) { return 'rgb(' + c.join( ',' ) + ')'; };
		var lineColour = function ( d ) {
			var c = rgb( d.colour ), bg = rgb( getComputedStyle( card ).backgroundColor ), k = 0;
			while ( night.matches && ratio( c, bg ) < 3 && k++ < 20 ) { c = c.map( function ( x ) { return Math.round( x + ( 255 - x ) * 0.1 ); } ); }
			return c;
		};
		var winsTo = function ( d, i ) { var n = 0; for ( var j = 0; j <= i; j++ ) { if ( R[ j ].win === d.name ) { n++; } } return n; };
		// The three after a round by points, level ones by wins so far, the standings' first tie-break.
		var ranked = function ( i ) {
			return D.map( function ( d, k ) { return { d: d, k: k }; } ).sort( function ( a, b ) { return b.d.p[ i ] - a.d.p[ i ] || winsTo( b.d, i ) - winsTo( a.d, i ) || a.k - b.k; } );
		};
		var describe = function ( i ) {
			var r = R[ i ], list = ranked( i ).map( function ( x ) { var gap = r.lead - x.d.p[ i ]; return x.d.name + ' ' + x.d.p[ i ] + ( gap > 0 ? ', ' + gap + ' behind' : '' ); } );
			if ( ! r.leader ) { list.unshift( r.other + ' leads on ' + r.lead ); }
			return 'After round ' + ( i + 1 ) + ', the ' + r.name + ' on ' + r.day + ', won by ' + r.win + ': ' + list.join( ' · ' ) + '.';
		};
		var set = function ( i ) {
			at = i;
			show( i );
			read.textContent = i === null ? ( compact ? 'Tap a round to read the standings after it.' : 'Point at a round, or tap it, to read the standings after it.' ) : describe( i );
			read.classList.toggle( 'is-on', i !== null );
		};
		var draw = function () {
			var W = Math.floor( box.clientWidth );
			if ( W < 200 ) { return; }
			compact = W < 560;
			var gapView = view === 'gap', left = compact ? 28 : 44, right = compact ? 76 : 150, last = N - 1;
			var mk = compact ? 16 : 18, stripY = mk + 9, stripH = 16, top = stripY + stripH + 12, plotH = compact ? 220 : 300, H = top + plotH + 30;
			var x0 = left, x1 = W - right, step = ( x1 - x0 ) / last;
			var X = function ( i ) { return x0 + i * step; };
			var val = function ( i, d ) { return gapView ? R[ i ].lead - d.p[ i ] : d.p[ i ]; };
			var most = 1;
			R.forEach( function ( r, i ) { D.forEach( function ( d ) { most = Math.max( most, val( i, d ) ); } ); } );
			var vmax = most * 1.05, every = gapView ? ( most > 250 ? 50 : 20 ) : ( most > 700 ? 200 : 100 );
			var Y = function ( v ) { return gapView ? top + v / vmax * plotH : top + plotH - v / vmax * plotH; };
			var C = D.map( lineColour );
			card.querySelectorAll( '.pd-tr-key .kl' ).forEach( function ( el, k ) { if ( C[ k ] ) { el.style.setProperty( '--t', css( C[ k ] ) ); } } );
			box.textContent = '';
			var svg = node( 'svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, tabindex: '0', role: 'img',
				'aria-label': ( gapView ? 'Points behind the leader' : 'Points' ) + ' after each of the ' + N + ' rounds, for ' + D.map( function ( d ) { return d.name; } ).join( ', ' ) + '. The arrow keys step through the rounds; the table below holds the same numbers.' }, box );
			for ( var t = 0; t <= vmax; t += every ) {
				node( 'line', { 'class': 'gl' + ( t === 0 ? ' zero' : '' ), x1: x0, x2: x1, y1: Y( t ), y2: Y( t ) }, svg );
				node( 'text', { 'class': 'tk', x: x0 - 9, y: Y( t ), 'text-anchor': 'end' }, svg, String( t ) );
			}
			for ( var i = 0; i < N; i++ ) {
				if ( compact && i !== 0 && i !== last && ( i + 1 ) % 5 ) { continue; }
				node( 'text', { 'class': 'tk', x: X( i ), y: top + plotH + 17, 'text-anchor': 'middle' }, svg, String( i + 1 ) );
			}
			if ( ! compact ) { node( 'text', { 'class': 'ax', x: 0, y: top + plotH + 17 }, svg, 'Round' ); }
			turns.forEach( function ( r, j ) {
				var x = X( r - 1 ), g;
				node( 'line', { 'class': 'tpl', x1: x, x2: x, y1: mk, y2: top + plotH }, svg );
				g = node( 'g', { 'class': 'tp' }, svg );
				node( 'rect', { x: x - mk / 2, y: 0, width: mk, height: mk }, g );
				node( 'text', { x: x, y: mk / 2 + 0.5 }, g, String( j + 1 ) );
			} );
			// The leader's run: his line's colour, a dashed driver's run outlined in dashes.
			var runs = [];
			R.forEach( function ( r, i ) {
				var who = r.leader ? r.leader.code : r.other, prev = runs[ runs.length - 1 ];
				if ( prev && prev.who === who ) { prev.to = i; } else { runs.push( { who: who, d: r.leader, from: i, to: i } ); }
			} );
			runs.forEach( function ( run ) {
				var a = X( run.from ) - step / 2 + 1, b = X( run.to ) + step / 2 - 1, k = run.d ? D.indexOf( run.d ) : -1, c = k >= 0 ? C[ k ] : [ 154, 163, 178 ], solid = ! run.d || ! run.d.dashed;
				node( 'rect', { x: a, y: stripY, width: b - a, height: stripH, fill: solid ? css( c ) : 'none', stroke: solid ? 'none' : css( c ), 'stroke-width': 1.5, 'stroke-dasharray': solid ? 'none' : '4 3' }, svg );
				var label = node( 'text', { 'class': 'run-t', x: ( a + b ) / 2, y: stripY + stripH / 2 + 0.5 }, svg, ( run.d ? run.d.name : run.who ) + ' leads' );
				if ( solid ) { label.style.fill = lum( c ) > 0.18 ? '#0f1217' : '#ffffff'; }
				if ( label.getComputedTextLength() > b - a - 8 ) { label.textContent = run.d ? run.d.code : ''; }
			} );
			D.forEach( function ( d, k ) {
				var path = '';
				for ( var i = 0; i < N; i++ ) { path += ( i ? 'L' : 'M' ) + X( i ).toFixed( 1 ) + ' ' + Y( val( i, d ) ).toFixed( 1 ); }
				node( 'path', { 'class': 'ln', d: path, stroke: css( C[ k ] ), 'stroke-dasharray': d.dashed ? '6 4' : 'none' }, svg );
			} );
			// The runner-up's furthest point behind, when he came back from it.
			if ( gapView ) {
				var m = 0;
				for ( var i = 1; i < N; i++ ) { if ( val( i, D[ 1 ] ) > val( m, D[ 1 ] ) ) { m = i; } }
				if ( m < last && val( m, D[ 1 ] ) > val( last, D[ 1 ] ) ) { node( 'text', { 'class': 'ann', x: X( m ) + 8, y: Y( val( m, D[ 1 ] ) ) + 1 }, svg, val( m, D[ 1 ] ) + ' behind' ); }
			}
			// Each line's end: the code and the total, the runner-up's margin beside it (under it on a phone), the labels
			// kept apart and tied to their lines where they had to move.
			var gap = compact ? 14 : 15, behind = R[ last ].lead - D[ 1 ].p[ last ];
			var ends = D.map( function ( d, k ) { return { d: d, k: k, y0: Y( val( last, d ) ), h: gapView && compact && k === 1 && behind > 0 ? gap + 14 : gap }; } ).sort( function ( a, b ) { return a.y0 - b.y0; } );
			ends.forEach( function ( e, j ) { e.y = j ? Math.max( e.y0, ends[ j - 1 ].y + ends[ j - 1 ].h ) : e.y0; } );
			var shift = ends.reduce( function ( s, e ) { return s + e.y0 - e.y; }, 0 ) / ends.length;
			ends.forEach( function ( e, j ) { e.y = Math.max( top - 4, e.y + shift ); if ( j ) { e.y = Math.max( e.y, ends[ j - 1 ].y + ends[ j - 1 ].h ); } } );
			ends.forEach( function ( e ) {
				var x = X( last ), text;
				if ( Math.abs( e.y - e.y0 ) > 2 ) { node( 'line', { 'class': 'con', x1: x + 5, y1: e.y0, x2: x + 11, y2: e.y }, svg ); }
				node( 'circle', { 'class': 'dot', cx: x, cy: e.y0, r: 4, fill: css( C[ e.k ] ) }, svg );
				text = node( 'text', { 'class': 'end', x: x + 14, y: e.y }, svg, e.d.code + ' ' );
				node( 'tspan', {}, text, String( e.d.p[ last ] ) );
				if ( gapView && e.k === 1 && behind > 0 ) {
					if ( compact ) { node( 'text', { 'class': 'ann key', x: x + 14, y: e.y + 14 }, svg, behind + ' behind' ); } else { node( 'tspan', { 'class': 'key' }, text, ' · ' + behind + ' behind' ); }
				}
			} );
			var cross = node( 'line', { 'class': 'cross', y1: top, y2: top + plotH, visibility: 'hidden' }, svg );
			var dots = D.map( function ( d, k ) { return node( 'circle', { 'class': 'dot', r: 4.5, fill: css( C[ k ] ), visibility: 'hidden' }, svg ); } );
			show = function ( i ) {
				var on = i !== null;
				cross.setAttribute( 'visibility', on ? 'visible' : 'hidden' );
				if ( on ) { cross.setAttribute( 'x1', X( i ) ); cross.setAttribute( 'x2', X( i ) ); }
				dots.forEach( function ( c, k ) {
					c.setAttribute( 'visibility', on ? 'visible' : 'hidden' );
					if ( on ) { c.setAttribute( 'cx', X( i ) ); c.setAttribute( 'cy', Y( val( i, D[ k ] ) ) ); }
				} );
			};
			var index = function ( clientX ) { var r = svg.getBoundingClientRect(); return Math.max( 0, Math.min( last, Math.round( ( clientX - r.left - x0 ) / step ) ) ); };
			// A mouse pins on press; a finger on a click, so a scroll that starts on the chart pins nothing.
			var pin = function ( i ) { if ( pinned && i === at ) { pinned = false; set( null ); } else { pinned = true; set( i ); } }, touched = false;
			svg.addEventListener( 'pointermove', function ( ev ) { var i = index( ev.clientX ); if ( ev.pointerType === 'mouse' && ! pinned && i !== at ) { set( i ); } } );
			svg.addEventListener( 'pointerleave', function ( ev ) { if ( ev.pointerType === 'mouse' && ! pinned ) { set( null ); } } );
			svg.addEventListener( 'pointerdown', function ( ev ) { touched = ev.pointerType !== 'mouse'; if ( ! touched ) { pin( index( ev.clientX ) ); } } );
			svg.addEventListener( 'click', function ( ev ) { if ( touched ) { pin( index( ev.clientX ) ); } } );
			svg.addEventListener( 'keydown', function ( ev ) {
				var by = { ArrowLeft: -1, ArrowRight: 1, Home: -N, End: N }[ ev.key ];
				if ( ev.key === 'Escape' ) { pinned = false; set( null ); return; }
				if ( by === undefined ) { return; }
				ev.preventDefault();
				pinned = true;
				set( Math.max( 0, Math.min( last, ( at === null ? N : at ) + by ) ) );
			} );
			set( at );
		};
		if ( seg ) {
			var buttons = seg.querySelectorAll( 'button[data-pd-tr]' ), title = card.querySelector( '.pd-tr-ct' );
			buttons.forEach( function ( b ) {
				b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-pd-tr' ) === view ) );
				b.addEventListener( 'click', function () {
					view = b.getAttribute( 'data-pd-tr' );
					buttons.forEach( function ( x ) { x.setAttribute( 'aria-pressed', String( x === b ) ); } );
					if ( title ) { title.textContent = view === 'gap' ? 'Points behind the leader' : 'Points'; }
					draw();
				} );
			} );
			seg.hidden = false;
		}
		var key = card.querySelector( '.pd-tr-key' ), table = card.querySelector( '.pd-tr-table' ), w = -1;
		box.hidden = false;
		read.hidden = false;
		if ( key ) { key.hidden = false; }
		if ( table ) { table.open = false; }
		var redraw = function () { var nw = box.clientWidth; if ( nw !== w ) { w = nw; draw(); } };
		redraw();
		if ( window.ResizeObserver ) { new ResizeObserver( function () { requestAnimationFrame( redraw ); } ).observe( box ); } else { window.addEventListener( 'resize', redraw ); }
		if ( night.addEventListener ) { night.addEventListener( 'change', draw ); }
	} );

	render();
	if ( ! frozen ) { setInterval( render, 30000 ); }

	// The series list (O21): the switch and the type chips filter the cards, the + follows (above), and Racing this
	// weekend shows the next rounds that meet the reader's own Friday to Sunday. Without the script every card shows.
	document.querySelectorAll( '.pd-sx' ).forEach( function ( page ) {
		var show = 'all', type = 'all', cards = page.querySelectorAll( '.pd-sx-card' );
		var apply = function () {
			var mine = followed(), n = 0;
			cards.forEach( function ( c ) {
				var mineToo = mine.indexOf( c.getAttribute( 'data-s' ) ) >= 0;
				if ( mineToo ) { n++; }
				c.hidden = ! ( ( type === 'all' || c.getAttribute( 'data-type' ) === type ) && ( show === 'all' || mineToo ) );
			} );
			page.querySelectorAll( '.pd-sx-type' ).forEach( function ( g ) { g.hidden = ! g.querySelector( '.pd-sx-card:not([hidden])' ); } );
			page.querySelectorAll( '.pd-sx-sec:not(.pd-sx-weekend)' ).forEach( function ( s ) { s.hidden = ! s.querySelector( '.pd-sx-card:not([hidden])' ); } );
			var count = page.querySelector( '[data-pd-sx-following]' ), none = page.querySelector( '.pd-sx-none' );
			if ( count ) { count.textContent = '· ' + n; }
			if ( none ) { none.hidden = ! ( show === 'following' && n === 0 ); }
			page.querySelectorAll( '[data-pd-sx-show]' ).forEach( function ( b ) { b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-pd-sx-show' ) === show ) ); } );
			page.querySelectorAll( '[data-pd-sx-type]' ).forEach( function ( b ) { b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-pd-sx-type' ) === type ) ); } );
		};
		page.querySelectorAll( '[data-pd-sx-show]' ).forEach( function ( b ) { b.addEventListener( 'click', function () { show = b.getAttribute( 'data-pd-sx-show' ); apply(); } ); } );
		page.querySelectorAll( '[data-pd-sx-type]' ).forEach( function ( b ) { b.addEventListener( 'click', function () { type = b.getAttribute( 'data-pd-sx-type' ); apply(); } ); } );
		document.addEventListener( 'pd-follow', apply );
		var ctl = page.querySelector( '.pd-sx-ctl' );
		if ( ctl ) { ctl.hidden = false; }
		apply();
		var now = new Date( nowAt() ), dow = ( now.getDay() + 6 ) % 7;
		var day = function ( n ) {
			var d = new Date( now.getFullYear(), now.getMonth(), now.getDate() + n );
			return d.getFullYear() + '-' + String( d.getMonth() + 1 ).padStart( 2, '0' ) + '-' + String( d.getDate() ).padStart( 2, '0' );
		};
		var fri = day( 4 - dow ), sun = day( 6 - dow ), shown = 0, wkSec = page.querySelector( '.pd-sx-weekend' );
		page.querySelectorAll( '.pd-sx-wk' ).forEach( function ( c ) {
			var on = c.getAttribute( 'data-from' ) <= sun && c.getAttribute( 'data-to' ) >= fri;
			c.hidden = ! on;
			if ( on ) { shown++; }
		} );
		if ( wkSec && shown ) {
			var month = function ( iso ) { return new Date( iso + 'T12:00:00Z' ).toLocaleString( 'en-GB', { month: 'long', timeZone: 'UTC' } ); };
			var span = fri.slice( 0, 7 ) === sun.slice( 0, 7 ) ? Number( fri.slice( 8 ) ) + '–' + Number( sun.slice( 8 ) ) + ' ' + month( sun ) : Number( fri.slice( 8 ) ) + ' ' + month( fri ) + ' – ' + Number( sun.slice( 8 ) ) + ' ' + month( sun );
			var label = wkSec.querySelector( '[data-pd-sx-count]' );
			if ( label ) { label.textContent = shown + ' championship' + ( shown === 1 ? '' : 's' ) + ' · ' + span; }
			wkSec.hidden = false;
		}
	} );

	// Standings (O16): Drivers, Constructors or Both, for the visit only. A laptop opens on Both and a phone on Drivers,
	// which has no Both: a window narrowed to a phone's width while on Both turns to Drivers. Without the script both
	// tables stand and the buttons stay hidden.
	document.querySelectorAll( '.pd-stp' ).forEach( function ( page ) {
		var seg = page.querySelector( '.pd-st-seg' ), phone = window.matchMedia( '(max-width: 699px)' );
		if ( ! seg ) { return; }
		var set = function ( show ) {
			page.setAttribute( 'data-show', show );
			seg.querySelectorAll( 'button[data-pd-st]' ).forEach( function ( b ) { b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-pd-st' ) === show ) ); } );
		};
		seg.querySelectorAll( 'button[data-pd-st]' ).forEach( function ( b ) { b.addEventListener( 'click', function () { set( b.getAttribute( 'data-pd-st' ) ); } ); } );
		if ( phone.addEventListener ) { phone.addEventListener( 'change', function () { if ( phone.matches && page.getAttribute( 'data-show' ) === 'both' ) { set( 'drivers' ); } } ); }
		seg.hidden = false;
		set( phone.matches ? 'drivers' : 'both' );
	} );

	// Champions (O17): the search, and a phone's one decade at a time. The search finds a season by year, champion,
	// runner-up or team, every word of the query, accents ignored; a decade with no match hides. On a phone the jump bar
	// shows one decade, the newest first, and an address naming a decade or a season opens it. The bar's height rides in
	// --pd-ch-bar so a jump lands below it. Without the script every decade stands and the jump bar's links jump.
	document.querySelectorAll( '.pd-chp' ).forEach( function ( page ) {
		var jump = page.querySelector( '.pd-ch-jump' ), slot = page.querySelector( '.pd-ch-find' ), count = page.querySelector( '.pd-ch-count' );
		var decs = Array.prototype.slice.call( page.querySelectorAll( '.pd-ch-dec' ) );
		if ( ! jump || ! decs.length ) { return; }
		var phone = window.matchMedia( '(max-width: 699px)' ), links = jump.querySelectorAll( 'a[data-dec]' ), of = count ? count.getAttribute( 'data-of' ) : '';
		var input = null, filter = function () {};
		var fold = function ( s ) { return ( s.normalize ? s.normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' ) : s ).toLowerCase(); };
		var setBar = function () { page.style.setProperty( '--pd-ch-bar', jump.offsetHeight + 'px' ); };
		var show = function ( dec ) {
			links.forEach( function ( a ) { a.classList.toggle( 'on', a.textContent === dec ); } );
			decs.forEach( function ( s ) { s.classList.toggle( 'is-on', s.getAttribute( 'data-dec' ) === dec ); } );
		};
		// An address's target: a decade (pd-ch-1970s), or a season (pd-ch-1958): its table row, or its card on a phone.
		var go = function ( id ) {
			var m = /^pd-ch-(\d{4})(s?)$/.exec( id || '' );
			if ( ! m ) { return false; }
			var dec = m[ 2 ] ? m[ 1 ] + 's' : m[ 1 ].slice( 0, 3 ) + '0s', section = page.querySelector( '.pd-ch-dec[data-dec="' + dec + '"]' );
			if ( ! section ) { return false; }
			show( dec );
			if ( phone.matches ) {
				var card = m[ 2 ] ? null : section.querySelector( 'li[data-find^="' + m[ 1 ] + ' "]' );
				( card || section ).scrollIntoView( { block: 'start' } );
			}
			return true;
		};
		jump.addEventListener( 'click', function ( e ) {
			var a = e.target.closest( 'a[data-dec]' );
			if ( a && go( a.getAttribute( 'href' ).slice( 1 ) ) && phone.matches ) { e.preventDefault(); }
		} );
		// A phone has no search box: a query left from a wider window is cleared, so no filter is stuck on.
		var phoneMode = function () {
			if ( phone.matches ) {
				if ( input && input.value ) {
					input.value = '';
					filter();
				}
				page.setAttribute( 'data-one', '' );
			} else {
				page.removeAttribute( 'data-one' );
			}
			setBar();
		};
		if ( slot ) {
			var none = document.createElement( 'p' );
			none.className = 'pd-ch-none';
			none.setAttribute( 'role', 'status' );
			none.textContent = 'No season or driver matches.';
			none.hidden = true;
			decs[ decs.length - 1 ].parentNode.appendChild( none );
			input = document.createElement( 'input' );
			input.type = 'search';
			input.placeholder = 'Find a season or a driver';
			input.setAttribute( 'aria-label', 'Find a season or a driver' );
			slot.appendChild( input );
			slot.hidden = false;
			if ( count ) { count.setAttribute( 'aria-live', 'polite' ); }
			filter = function () {
				var words = fold( input.value ).split( ' ' ).filter( Boolean ), shown = 0;
				page.classList.toggle( 'is-finding', words.length > 0 );
				decs.forEach( function ( s ) {
					var any = false;
					s.querySelectorAll( '[data-find]' ).forEach( function ( el ) {
						var text = el.getAttribute( 'data-find' ), hit = words.every( function ( w ) { return text.indexOf( w ) !== -1; } );
						el.hidden = ! hit;
						if ( hit ) { any = true; }
					} );
					s.querySelectorAll( '.era' ).forEach( function ( el ) { el.hidden = words.length > 0; } );
					s.hidden = ! any;
				} );
				page.querySelectorAll( '.pd-ch-tbl tr[data-find]' ).forEach( function ( tr ) { if ( ! tr.hidden ) { shown++; } } );
				if ( count ) { count.textContent = words.length ? shown + ' of ' + of + ' seasons' : of + ' seasons'; }
				none.hidden = shown > 0;
			};
			input.addEventListener( 'input', filter );
			input.addEventListener( 'keydown', function ( e ) {
				if ( e.key === 'Escape' && input.value ) {
					input.value = '';
					filter();
				}
			} );
		}
		if ( phone.addEventListener ) { phone.addEventListener( 'change', phoneMode ); }
		window.addEventListener( 'resize', setBar );
		// The web font can rewrap the bar after the first measure.
		if ( document.fonts && document.fonts.ready ) { document.fonts.ready.then( setBar ); }
		show( decs[ 0 ].getAttribute( 'data-dec' ) );
		phoneMode();
		go( location.hash.slice( 1 ) );
	} );

	// Results (O15): a round's tile on the Overview links /series/<slug>/results/#r12, and that round's fold opens.
	var openRound = function () {
		var id = location.hash.slice( 1 ), el = /^r\d+$/.test( id ) ? document.getElementById( id ) : null;
		if ( el && el.tagName === 'DETAILS' ) {
			el.open = true;
			el.scrollIntoView( { block: 'start' } );
		}
	};
	openRound();
	window.addEventListener( 'hashchange', openRound );

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
