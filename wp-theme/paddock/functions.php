<?php
/**
 * Paddock: Twenty Twenty-Five's child carrying round 2's design.
 *
 * A block child theme loads no stylesheet by itself, so this file enqueues
 * style.css on the site and in the editor, and the one script that turns the
 * publisher's UTC times into the reader's zone and works out Live and Next.
 *
 * @package Paddock
 */

defined( 'ABSPATH' ) || exit;

// Priority 20 prints this after Twenty Twenty-Five's stylesheet, so equal selectors resolve in the child's favour.
add_action(
	'wp_enqueue_scripts',
	function () {
		$version = wp_get_theme()->get( 'Version' );
		wp_enqueue_style( 'paddock', get_stylesheet_uri(), array(), $version );
		wp_enqueue_script(
			'paddock',
			get_stylesheet_directory_uri() . '/assets/js/paddock.js',
			array(),
			$version,
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);
	},
	20
);

add_action(
	'after_setup_theme',
	function () {
		add_editor_style( 'style.css' );
	}
);

/*
 * [pd_series_posts category="formula-1" title="Formula 1" series="f1"]: a series page's "From the blog", its
 * category's three newest posts, written by the publisher (lib/wp/series.ts) as a shortcode so the page needs no
 * category id; nothing at all when the category has no posts.
 */
add_shortcode(
	'pd_series_posts',
	function ( $atts ) {
		$atts = shortcode_atts(
			array(
				'category' => '',
				'title'    => '',
				'series'   => '',
			),
			$atts,
			'pd_series_posts'
		);
		$term = get_category_by_slug( sanitize_title( $atts['category'] ) );
		if ( ! $term ) {
			return '';
		}
		$posts = get_posts(
			array(
				'numberposts' => 3,
				'category'    => $term->term_id,
				'post_status' => 'publish',
			)
		);
		if ( ! $posts ) {
			return '';
		}
		$items = '';
		foreach ( $posts as $post ) {
			// The post's cover leads its card, linked but out of the tab order: the title stays the link a keyboard and a
			// screen reader use. A post without one keeps the plain card.
			$cover = has_post_thumbnail( $post )
				? sprintf(
					'<a class="pd-sr-post-cover" href="%s" tabindex="-1" aria-hidden="true">%s</a>',
					esc_url( get_permalink( $post ) ),
					get_the_post_thumbnail(
						$post,
						'medium_large',
						array(
							'class'   => 'pd-sr-post-img',
							'alt'     => '',
							'loading' => 'lazy',
							'sizes'   => '(max-width: 699px) 100vw, 33vw',
						)
					)
				)
				: '';
			$items .= sprintf( '<li>%s<small>%s</small><a href="%s">%s</a></li>', $cover, esc_html( get_the_date( 'j M', $post ) ), esc_url( get_permalink( $post ) ), esc_html( get_the_title( $post ) ) );
		}
		$name = '' !== $atts['title'] ? $atts['title'] : $term->name;
		return sprintf(
			'<section class="pd-sr-blog pd-s-%s"><div class="pd-sh"><h2>From the blog</h2><p><a href="%s">%s</a></p></div><ul class="pd-sr-posts">%s</ul></section>',
			esc_attr( sanitize_title( $atts['series'] ) ),
			esc_url( get_category_link( $term ) ),
			esc_html( sprintf( 'All %s posts →', $name ) ),
			$items
		);
	}
);
