<?php
/**
 * VERSACE22 — Projects, Memory, Conversation-Project Assignment
 *
 * AJAX handlers for the React frontend additions. These complement
 * the existing AI Chat Persona Pro (aicpp) plugin tables/handlers.
 *
 * Tables created on first load (idempotent):
 *   {prefix}aicpp_projects          (id, user_id, name, description, custom_instructions, created_at)
 *   {prefix}aicpp_user_memories     (id, user_id, content, created_at)
 *
 * Adds a project_id column to {prefix}aicpp_conversations if missing.
 *
 * AJAX actions registered (logged-in users only):
 *   aicpp_get_projects, aicpp_create_project, aicpp_delete_project
 *   aicpp_assign_conversation_project
 *   aicpp_get_memories, aicpp_add_memory, aicpp_delete_memory, aicpp_clear_memories
 *
 * Security: all handlers require a valid nonce (action 'aicpp_chat')
 * and `is_user_logged_in()`. All queries scope rows by current user_id.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('versace22_projects_install_schema')) {
    function versace22_projects_install_schema() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();

        $projects   = $wpdb->prefix . 'aicpp_projects';
        $memories   = $wpdb->prefix . 'aicpp_user_memories';
        $conversations = $wpdb->prefix . 'aicpp_conversations';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        dbDelta("CREATE TABLE {$projects} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            name varchar(190) NOT NULL,
            description text NULL,
            custom_instructions longtext NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_id (user_id)
        ) $charset;");

        dbDelta("CREATE TABLE {$memories} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            content text NOT NULL,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_id (user_id)
        ) $charset;");

        // Add project_id column to conversations if the table exists and column missing.
        $table_exists = $wpdb->get_var($wpdb->prepare(
            "SHOW TABLES LIKE %s", $conversations
        ));
        if ($table_exists) {
            $col = $wpdb->get_results($wpdb->prepare(
                "SHOW COLUMNS FROM {$conversations} LIKE %s", 'project_id'
            ));
            if (empty($col)) {
                $wpdb->query("ALTER TABLE {$conversations} ADD COLUMN project_id BIGINT(20) UNSIGNED NULL DEFAULT NULL, ADD INDEX project_id_idx (project_id)");
            }
        }
    }
    add_action('plugins_loaded', 'versace22_projects_install_schema');
}

if (!function_exists('versace22_projects_check_request')) {
    function versace22_projects_check_request() {
        if (!check_ajax_referer('aicpp_chat', 'nonce', false)) {
            wp_send_json_error(array('message' => 'Invalid security token'));
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(array('message' => 'You must be logged in'));
        }
        return get_current_user_id();
    }
}

// ===================== PROJECTS =====================

if (!function_exists('versace22_ajax_get_projects')) {
    function versace22_ajax_get_projects() {
        $user_id = versace22_projects_check_request();
        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_projects';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, name, description, custom_instructions, created_at
             FROM {$table} WHERE user_id = %d ORDER BY created_at DESC",
            $user_id
        ), ARRAY_A);
        wp_send_json_success(array('projects' => $rows ?: array()));
    }
    add_action('wp_ajax_aicpp_get_projects', 'versace22_ajax_get_projects');
}

if (!function_exists('versace22_ajax_create_project')) {
    function versace22_ajax_create_project() {
        $user_id = versace22_projects_check_request();
        $name = isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '';
        $desc = isset($_POST['description']) ? sanitize_textarea_field(wp_unslash($_POST['description'])) : '';
        $instr = isset($_POST['custom_instructions']) ? sanitize_textarea_field(wp_unslash($_POST['custom_instructions'])) : '';

        if ($name === '' || mb_strlen($name) > 190) {
            wp_send_json_error(array('message' => 'Project name is required (max 190 chars).'));
        }
        if (mb_strlen($instr) > 5000) {
            wp_send_json_error(array('message' => 'Custom instructions too long.'));
        }

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_projects';
        $ok = $wpdb->insert($table, array(
            'user_id' => $user_id,
            'name' => $name,
            'description' => $desc,
            'custom_instructions' => $instr,
            'created_at' => current_time('mysql'),
        ), array('%d', '%s', '%s', '%s', '%s'));

        if (!$ok) {
            wp_send_json_error(array('message' => 'Failed to create project'));
        }

        $id = (int) $wpdb->insert_id;
        wp_send_json_success(array('project' => array(
            'id' => $id,
            'name' => $name,
            'description' => $desc,
            'custom_instructions' => $instr,
            'created_at' => current_time('mysql'),
        )));
    }
    add_action('wp_ajax_aicpp_create_project', 'versace22_ajax_create_project');
}

if (!function_exists('versace22_ajax_delete_project')) {
    function versace22_ajax_delete_project() {
        $user_id = versace22_projects_check_request();
        $pid = isset($_POST['project_id']) ? (int) $_POST['project_id'] : 0;
        if ($pid <= 0) wp_send_json_error(array('message' => 'Invalid project id'));

        global $wpdb;
        $projects = $wpdb->prefix . 'aicpp_projects';
        $conversations = $wpdb->prefix . 'aicpp_conversations';

        // Clear assignments before deletion.
        $wpdb->query($wpdb->prepare(
            "UPDATE {$conversations} SET project_id = NULL WHERE project_id = %d AND user_id = %d",
            $pid, $user_id
        ));

        $deleted = $wpdb->delete($projects, array('id' => $pid, 'user_id' => $user_id), array('%d', '%d'));
        if ($deleted === false) wp_send_json_error(array('message' => 'Delete failed'));

        wp_send_json_success(array('deleted' => (int) $deleted));
    }
    add_action('wp_ajax_aicpp_delete_project', 'versace22_ajax_delete_project');
}

if (!function_exists('versace22_ajax_assign_conversation_project')) {
    function versace22_ajax_assign_conversation_project() {
        $user_id = versace22_projects_check_request();
        $conv_id = isset($_POST['conversation_id']) ? (int) $_POST['conversation_id'] : 0;
        $raw_pid = isset($_POST['project_id']) ? trim(wp_unslash($_POST['project_id'])) : '';
        $pid = ($raw_pid === '' || $raw_pid === '0') ? null : (int) $raw_pid;

        if ($conv_id <= 0) wp_send_json_error(array('message' => 'Invalid conversation id'));

        global $wpdb;
        $conversations = $wpdb->prefix . 'aicpp_conversations';
        $projects = $wpdb->prefix . 'aicpp_projects';

        // Validate ownership of conversation.
        $owns_conv = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$conversations} WHERE id = %d AND user_id = %d",
            $conv_id, $user_id
        ));
        if (!$owns_conv) wp_send_json_error(array('message' => 'Conversation not found'));

        // Validate ownership of project if assigning.
        if ($pid !== null) {
            $owns_proj = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$projects} WHERE id = %d AND user_id = %d",
                $pid, $user_id
            ));
            if (!$owns_proj) wp_send_json_error(array('message' => 'Project not found'));
        }

        $wpdb->update(
            $conversations,
            array('project_id' => $pid),
            array('id' => $conv_id, 'user_id' => $user_id),
            array($pid === null ? 'NULL' : '%d'),
            array('%d', '%d')
        );

        wp_send_json_success(array('conversation_id' => $conv_id, 'project_id' => $pid));
    }
    add_action('wp_ajax_aicpp_assign_conversation_project', 'versace22_ajax_assign_conversation_project');
}

// ===================== MEMORY =====================

if (!function_exists('versace22_ajax_get_memories')) {
    function versace22_ajax_get_memories() {
        $user_id = versace22_projects_check_request();
        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_memories';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, content, created_at FROM {$table} WHERE user_id = %d ORDER BY created_at DESC",
            $user_id
        ), ARRAY_A);
        wp_send_json_success(array('memories' => $rows ?: array()));
    }
    add_action('wp_ajax_aicpp_get_memories', 'versace22_ajax_get_memories');
}

if (!function_exists('versace22_ajax_add_memory')) {
    function versace22_ajax_add_memory() {
        $user_id = versace22_projects_check_request();
        $content = isset($_POST['content']) ? sanitize_textarea_field(wp_unslash($_POST['content'])) : '';
        if ($content === '') wp_send_json_error(array('message' => 'Memory cannot be empty'));
        if (mb_strlen($content) > 1000) wp_send_json_error(array('message' => 'Memory too long (max 1000 chars)'));

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_memories';
        $ok = $wpdb->insert($table, array(
            'user_id' => $user_id,
            'content' => $content,
            'created_at' => current_time('mysql'),
        ), array('%d', '%s', '%s'));

        if (!$ok) wp_send_json_error(array('message' => 'Failed to save memory'));

        wp_send_json_success(array('memory' => array(
            'id' => (int) $wpdb->insert_id,
            'content' => $content,
            'created_at' => current_time('mysql'),
        )));
    }
    add_action('wp_ajax_aicpp_add_memory', 'versace22_ajax_add_memory');
}

if (!function_exists('versace22_ajax_delete_memory')) {
    function versace22_ajax_delete_memory() {
        $user_id = versace22_projects_check_request();
        $mid = isset($_POST['memory_id']) ? (int) $_POST['memory_id'] : 0;
        if ($mid <= 0) wp_send_json_error(array('message' => 'Invalid memory id'));

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_memories';
        $deleted = $wpdb->delete($table, array('id' => $mid, 'user_id' => $user_id), array('%d', '%d'));
        if ($deleted === false) wp_send_json_error(array('message' => 'Delete failed'));

        wp_send_json_success(array('deleted' => (int) $deleted));
    }
    add_action('wp_ajax_aicpp_delete_memory', 'versace22_ajax_delete_memory');
}

if (!function_exists('versace22_ajax_clear_memories')) {
    function versace22_ajax_clear_memories() {
        $user_id = versace22_projects_check_request();
        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_memories';
        $deleted = $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE user_id = %d", $user_id));
        wp_send_json_success(array('deleted' => (int) $deleted));
    }
    add_action('wp_ajax_aicpp_clear_memories', 'versace22_ajax_clear_memories');
}

// ============================================================
// USER-SCOPED ACTION ALIASES (aicpp_user_*)
//
// The React frontend in src/lib/wp-api.ts calls aicpp_user_* action names so
// it never collides with the admin-only handlers registered by the main
// ai-chat-persona-pro plugin on aicpp_get_projects / aicpp_get_memories / etc.
// These aliases reuse the login-only, user-scoped callbacks defined above.
// ============================================================
add_action('wp_ajax_aicpp_user_list_projects',                'versace22_ajax_get_projects');
add_action('wp_ajax_aicpp_user_create_project',               'versace22_ajax_create_project');
add_action('wp_ajax_aicpp_user_delete_project',               'versace22_ajax_delete_project');
add_action('wp_ajax_aicpp_user_assign_conversation_project',  'versace22_ajax_assign_conversation_project');
add_action('wp_ajax_aicpp_user_get_memories',                 'versace22_ajax_get_memories');
add_action('wp_ajax_aicpp_user_add_memory',                   'versace22_ajax_add_memory');
add_action('wp_ajax_aicpp_user_delete_memory',                'versace22_ajax_delete_memory');

// ============================================================
// DATA SOURCES (user-scoped) — schema + handlers
// ============================================================
if (!function_exists('versace22_data_sources_install_schema')) {
    function versace22_data_sources_install_schema() {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta("CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            provider varchar(64) NOT NULL,
            label varchar(190) NULL,
            credentials longtext NULL,
            status varchar(32) NOT NULL DEFAULT 'connected',
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY provider (provider)
        ) $charset;");
    }
    add_action('plugins_loaded', 'versace22_data_sources_install_schema');
}

if (!function_exists('versace22_ajax_list_data_sources')) {
    function versace22_ajax_list_data_sources() {
        $user_id = versace22_projects_check_request();
        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, provider, label, status, created_at FROM {$table}
             WHERE user_id = %d ORDER BY created_at DESC",
            $user_id
        ), ARRAY_A);
        wp_send_json_success(array('sources' => $rows ?: array()));
    }
    add_action('wp_ajax_aicpp_user_list_data_sources', 'versace22_ajax_list_data_sources');
}

if (!function_exists('versace22_ajax_connect_data_source')) {
    function versace22_ajax_connect_data_source() {
        $user_id = versace22_projects_check_request();
        $provider = isset($_POST['provider']) ? sanitize_key(wp_unslash($_POST['provider'])) : '';
        $label = isset($_POST['label']) ? sanitize_text_field(wp_unslash($_POST['label'])) : '';
        $creds = isset($_POST['credentials']) ? sanitize_textarea_field(wp_unslash($_POST['credentials'])) : '';
        if ($provider === '') wp_send_json_error(array('message' => 'Provider is required'));

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        $ok = $wpdb->insert($table, array(
            'user_id' => $user_id,
            'provider' => $provider,
            'label' => $label !== '' ? $label : $provider,
            'credentials' => $creds,
            'status' => 'connected',
            'created_at' => current_time('mysql'),
        ), array('%d', '%s', '%s', '%s', '%s', '%s'));
        if (!$ok) wp_send_json_error(array('message' => 'Failed to connect data source'));
        wp_send_json_success(array('id' => (int) $wpdb->insert_id));
    }
    add_action('wp_ajax_aicpp_user_connect_data_source', 'versace22_ajax_connect_data_source');
}

if (!function_exists('versace22_ajax_disconnect_data_source')) {
    function versace22_ajax_disconnect_data_source() {
        $user_id = versace22_projects_check_request();
        $sid = isset($_POST['source_id']) ? (int) $_POST['source_id'] : 0;
        if ($sid <= 0) wp_send_json_error(array('message' => 'Invalid source id'));
        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        $deleted = $wpdb->delete($table, array('id' => $sid, 'user_id' => $user_id), array('%d', '%d'));
        if ($deleted === false) wp_send_json_error(array('message' => 'Delete failed'));
        wp_send_json_success(array('deleted' => (int) $deleted));
    }
    add_action('wp_ajax_aicpp_user_disconnect_data_source', 'versace22_ajax_disconnect_data_source');
}
