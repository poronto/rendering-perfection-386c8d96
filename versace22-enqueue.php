<?php
/**
 * Enqueue VERSACE22 AI Chat Assets
 * Include this file from ai-chat-persona-pro929.php using:
 * require_once plugin_dir_path(__FILE__) . 'versace22-enqueue.php';
 */

if (!defined('ABSPATH')) {
    exit;
}

function versace22_enqueue_chat_assets() {
    $plugin_url = plugin_dir_url(__FILE__);

    wp_enqueue_style(
        'versace22-chat-style',
        $plugin_url . 'Assets/index.css',
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'Assets/index.css')
    );

    wp_enqueue_script(
        'versace22-chat-script',
        $plugin_url . 'Assets/index.js',
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'Assets/index.js'),
        true
    );
}
add_action('wp_enqueue_scripts', 'versace22_enqueue_chat_assets');
