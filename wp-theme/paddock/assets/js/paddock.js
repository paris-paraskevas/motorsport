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
	try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone; } catch ( e ) {}
	var fmt = function ( o ) { return new Intl.DateTimeFormat( 'en-GB', Object.assign( { timeZone: zone }, o ) ); };
	var fWd = fmt( { weekday: 'short' } ), fT = fmt( { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } );
	var fDay = fmt( { year: 'numeric', month: '2-digit', day: '2-digit' } ), fD = fmt( { weekday: 'short', day: 'numeric', month: 'short' } );

	function inWords( ms ) {
		var m = Math.max( 0, Math.round( ms / 60000 ) ), h = Math.floor( m / 60 );
		if ( h >= 48 ) { return 'in ' + Math.round( h / 24 ) + ' days'; }
		return h > 0 ? 'in ' + h + ' h ' + ( m % 60 ) + ' min' : 'in ' + m + ' min';
	}

	function render() {
		var now = frozen ? Date.parse( frozen.getAttribute( 'data-pd-now' ) ) : Date.now();
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
			if ( ! ( left > 0 ) ) { el.hidden = true; return; }
			var m = Math.round( left / 60000 ), h = Math.floor( m / 60 );
			var units = h >= 24 ? [ Math.floor( h / 24 ), 'days', h % 24, 'hours' ] : [ h, 'hours', m % 60, 'minutes' ];
			[ 'a', 'b' ].forEach( function ( k, i ) {
				var n = el.querySelector( '[data-pd-cd="' + k + '"]' ), l = el.querySelector( '[data-pd-cdl="' + k + '"]' );
				if ( n ) { n.textContent = String( units[ i * 2 ] ); }
				if ( l ) { l.textContent = units[ i * 2 + 1 ]; }
			} );
		} );

		document.querySelectorAll( '.pd-sessions, .pd-rows' ).forEach( function ( group ) {
			var nextFound = false;
			group.querySelectorAll( '.pd-st[data-pd-start]' ).forEach( function ( st ) {
				var start = Date.parse( st.getAttribute( 'data-pd-start' ) ), end = Date.parse( st.getAttribute( 'data-pd-end' ) ) || start;
				var item = st.closest( '.pd-ses, li' ), row = group.classList.contains( 'pd-rows' );
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
	}
	render();
	if ( ! frozen ) { setInterval( render, 30000 ); }

	var here = location.pathname.replace( /\/+$/, '/' );
	document.querySelectorAll( '.pd-tabs a, .pd-nav a' ).forEach( function ( a ) {
		var path = new URL( a.href, location.href ).pathname;
		if ( path === here ) { a.setAttribute( 'aria-current', 'page' ); }
	} );
}() );
