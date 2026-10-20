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
	}
);

add_action(
	'after_setup_theme',
	function () {
		add_editor_style( 'style.css' );
	}
);
