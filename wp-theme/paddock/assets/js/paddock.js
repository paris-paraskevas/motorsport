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
	// the reader's own day, adds the views, the series chips and the follow switch, and marks the clock change.
	var fOff = null, fAbbr = null;
	try { fOff = fmt( { timeZoneName: 'shortOffset' } ); fAbbr = fmt( { timeZoneName: 'short' } ); } catch {}
	var calStore = {
		get: function ( k ) { try { return window.localStorage.getItem( k ); } catch { return null; } },
		set: function ( k, v ) { try { window.localStorage.setItem( k, v ); } catch {} }
	};
	var followed = function () { return ( calStore.get( 'pd-follow' ) || '' ).split( ',' ).filter( Boolean ); };
	var onlyMine = function () { return calStore.get( 'pd-follow-only' ) === '1'; };
	var byStart = function ( a, b ) { return a.getAttribute( 'data-utc' ) < b.getAttribute( 'data-utc' ) ? -1 : 1; };
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
		var items = Array.prototype.slice.call( days.querySelectorAll( '.pd-wc-s' ) ).sort( byStart );
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

	/** The month view lists three sessions a day, then "+N more"; the week view lists every one. */
	function limitCells( cal ) {
		var week = cal.getAttribute( 'data-view' ) === 'week';
		cal.querySelectorAll( '.pd-cal-ses' ).forEach( function ( cell ) {
			var old = cell.querySelector( '.pd-cal-more' ), shown = 0, extra = 0;
			if ( old ) { old.remove(); }
			cell.querySelectorAll( '.pd-cs' ).forEach( function ( item ) {
				item.classList.remove( 'is-more' );
				if ( item.classList.contains( 'is-filtered' ) || ( ! week && item.getAttribute( 'data-key' ) !== '1' ) ) { return; }
				if ( ! week && shown >= 3 ) { item.classList.add( 'is-more' ); extra++; } else { shown++; }
			} );
			if ( extra ) {
				var more = document.createElement( 'span' );
				more.className = 'pd-cal-more';
				more.textContent = '+' + extra + ' more';
				cell.appendChild( more );
			}
		} );
	}

	function applyFilter( cal ) {
		var mine = followed(), on = onlyMine() && mine.length > 0;
		cal.querySelectorAll( '.pd-cs, .pd-cal-band, .pd-wc' ).forEach( function ( el ) {
			el.classList.toggle( 'is-filtered', on && mine.indexOf( el.getAttribute( 'data-s' ) ) < 0 );
		} );
		limitCells( cal );
	}

	/** The series chips become follow toggles, kept in this browser; then the switch, the views and the week steps. */
	function buildControls( cal, today ) {
		cal.querySelectorAll( 'span.pd-cal-chip' ).forEach( function ( chip ) {
			var s = chip.getAttribute( 'data-s' ), b = document.createElement( 'button' );
			b.type = 'button';
			b.className = chip.className;
			b.setAttribute( 'data-s', s );
			b.setAttribute( 'aria-pressed', String( followed().indexOf( s ) >= 0 ) );
			b.setAttribute( 'aria-label', 'Follow ' + chip.textContent );
			b.textContent = chip.textContent;
			b.addEventListener( 'click', function () {
				var mine = followed(), at = mine.indexOf( s );
				if ( at >= 0 ) { mine.splice( at, 1 ); } else { mine.push( s ); }
				calStore.set( 'pd-follow', mine.join( ',' ) );
				b.setAttribute( 'aria-pressed', String( at < 0 ) );
				applyFilter( cal );
			} );
			chip.replaceWith( b );
		} );
		var slot = cal.querySelector( '[data-pd-follow]' );
		if ( slot ) {
			var sw = document.createElement( 'button' ), note = document.createElement( 'small' );
			sw.type = 'button';
			sw.className = 'pd-cal-switch';
			sw.setAttribute( 'role', 'switch' );
			sw.setAttribute( 'aria-checked', String( onlyMine() ) );
			sw.appendChild( document.createElement( 'i' ) );
			sw.appendChild( document.createTextNode( 'Only series I follow' ) );
			note.textContent = 'on this device';
			sw.addEventListener( 'click', function () {
				var on = ! onlyMine();
				calStore.set( 'pd-follow-only', on ? '1' : '0' );
				sw.setAttribute( 'aria-checked', String( on ) );
				applyFilter( cal );
			} );
			slot.appendChild( sw );
			slot.appendChild( note );
		}
		var weeks = Array.prototype.slice.call( cal.querySelectorAll( '.pd-cal-wk' ) ), shown = 0;
		weeks.forEach( function ( w, i ) { if ( w.querySelector( '[data-date="' + today + '"]' ) ) { shown = i; } } );
		var showWeek = function () { weeks.forEach( function ( w, i ) { w.classList.toggle( 'is-week', i === shown ); } ); };
		var views = cal.querySelector( '[data-pd-views]' );
		var setView = function ( v ) {
			cal.setAttribute( 'data-view', v );
			if ( views ) { views.querySelectorAll( '[data-v]' ).forEach( function ( b ) { b.setAttribute( 'aria-pressed', String( b.getAttribute( 'data-v' ) === v ) ); } ); }
			limitCells( cal );
		};
		if ( views ) {
			[ [ 'month', 'Month' ], [ 'week', 'Week' ], [ 'agenda', 'Agenda' ] ].forEach( function ( v ) {
				var b = document.createElement( 'button' );
				b.type = 'button';
				b.setAttribute( 'data-v', v[ 0 ] );
				b.textContent = v[ 1 ];
				b.addEventListener( 'click', function () { setView( v[ 0 ] ); } );
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
		showWeek();
		setView( window.matchMedia && window.matchMedia( '(max-width: 699px)' ).matches ? 'agenda' : 'month' );
	}

	function setupCalendar( cal ) {
		cal.querySelectorAll( '.pd-cs[data-utc]' ).forEach( function ( item ) {
			var cell = cal.querySelector( '.pd-cal-ses[data-date="' + isoDay( item.getAttribute( 'data-utc' ) ) + '"]' );
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
		applyFilter( cal );
	}

	/** Live now, Next and Final on a card's sessions, and its Live pill. */
	function cardStates( card, now ) {
		var items = Array.prototype.slice.call( card.querySelectorAll( '.pd-wc-s' ) );
		var span = function ( s ) { var a = Date.parse( s.getAttribute( 'data-utc' ) ); return [ a, Date.parse( s.getAttribute( 'data-end' ) ) || a ]; };
		var live = items.filter( function ( s ) { var t = span( s ); return now >= t[ 0 ] && now < t[ 1 ]; } )[ 0 ] || null;
		var next = live ? items.filter( function ( s ) { return span( s )[ 0 ] > now; } )[ 0 ] || null : null;
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
		var weekends = cal.querySelectorAll( '.pd-cal-wkend' ), past = 0;
		weekends.forEach( function ( wk ) {
			var head = wk.querySelector( '.pd-cal-wkh span' ), count = wk.querySelector( '.pd-cal-wkh small' );
			if ( ! head || ! count ) { return; }
			if ( ! head.hasAttribute( 'data-dates' ) ) {
				head.setAttribute( 'data-dates', head.textContent );
				count.setAttribute( 'data-count', count.textContent );
			}
			var from = wk.getAttribute( 'data-from' ), name = from === fri ? 'This weekend' : from === nextFri ? 'Next weekend' : '';
			head.textContent = name || head.getAttribute( 'data-dates' );
			count.textContent = ( name ? head.getAttribute( 'data-dates' ) + ' · ' : '' ) + count.getAttribute( 'data-count' );
			var gone = wk.getAttribute( 'data-to' ) < today;
			wk.classList.toggle( 'is-past', gone );
			if ( gone ) { past++; }
		} );
		var agenda = cal.querySelector( '.pd-cal-agenda' ), button = agenda && agenda.querySelector( '.pd-cal-earlier' );
		if ( past && past === weekends.length ) { cal.classList.add( 'is-earlier' ); }
		if ( agenda && past && ! button && ! cal.classList.contains( 'is-earlier' ) ) {
			button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'pd-cal-earlier';
			button.addEventListener( 'click', function () { cal.classList.add( 'is-earlier' ); button.remove(); } );
			agenda.insertBefore( button, agenda.firstChild );
		}
		if ( button && button.isConnected ) { button.textContent = 'Show ' + past + ' earlier weekend' + ( past === 1 ? '' : 's' ); }
	}

	document.querySelectorAll( '.pd-cal' ).forEach( setupCalendar );
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
