<?php
/**
 * Enqueue VERSACE22 AI Chat Assets
 * Include this file from your main plugin file using:
 * if (file_exists(plugin_dir_path(__FILE__) . 'versace22-enqueue.php')) {
 *     require_once plugin_dir_path(__FILE__) . 'versace22-enqueue.php';
 * }
 */

if (!defined('ABSPATH')) {
    exit;
}

// Add the chat container div to the footer
function versace22_render_chat_container() {
    echo '<div id="versace22-chat-root" style="position:fixed;bottom:0;right:0;z-index:99999;width:100%;height:100vh;pointer-events:none;"></div>';
}
add_action('wp_footer', 'versace22_render_chat_container');

// Enqueue the scoped JS and CSS
function versace22_enqueue_chat_assets() {
    $plugin_url = plugin_dir_url(__FILE__);
    $plugin_path = plugin_dir_path(__FILE__);

    $css_file = $plugin_path . 'Assets/index.css';
    $js_file = $plugin_path . 'Assets/index.js';

    if (file_exists($css_file)) {
        wp_enqueue_style(
            'versace22-chat-style',
            $plugin_url . 'Assets/index.css',
            array(),
            filemtime($css_file)
        );
    }

    if (file_exists($js_file)) {
        wp_enqueue_script(
            'versace22-chat-script',
            $plugin_url . 'Assets/index.js',
            array(),
            filemtime($js_file),
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'versace22_enqueue_chat_assets');
