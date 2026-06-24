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
if (!function_exists('versace22_data_source_providers')) {
    function versace22_data_source_providers() {
        return array(
            'asana'            => array('name' => 'Asana', 'type' => 'oauth', 'auth_url' => 'https://app.asana.com/-/oauth_authorize', 'token_url' => 'https://app.asana.com/-/oauth_token', 'scope' => 'default'),
            'bigquery'         => array('name' => 'Google', 'type' => 'oauth', 'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth', 'token_url' => 'https://oauth2.googleapis.com/token', 'scope' => 'openid email profile https://www.googleapis.com/auth/bigquery.readonly'),
            'confluence'       => array('name' => 'Atlassian', 'type' => 'oauth', 'auth_url' => 'https://auth.atlassian.com/authorize', 'token_url' => 'https://auth.atlassian.com/oauth/token', 'scope' => 'read:me read:confluence-content.all offline_access', 'audience' => 'api.atlassian.com'),
            'coworker_bot'     => array('name' => 'Slack', 'type' => 'oauth', 'auth_url' => 'https://slack.com/oauth/v2/authorize', 'token_url' => 'https://slack.com/api/oauth.v2.access', 'scope' => 'chat:write,channels:read,users:read'),
            'google_calendar'  => array('name' => 'Google', 'type' => 'oauth', 'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth', 'token_url' => 'https://oauth2.googleapis.com/token', 'scope' => 'openid email profile https://www.googleapis.com/auth/calendar.readonly'),
            'google_drive'     => array('name' => 'Google', 'type' => 'oauth', 'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth', 'token_url' => 'https://oauth2.googleapis.com/token', 'scope' => 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly'),
            'github'           => array('name' => 'GitHub', 'type' => 'oauth', 'auth_url' => 'https://github.com/login/oauth/authorize', 'token_url' => 'https://github.com/login/oauth/access_token', 'scope' => 'repo read:user user:email'),
            'hubspot_read'     => array('name' => 'HubSpot', 'type' => 'oauth', 'auth_url' => 'https://app.hubspot.com/oauth/authorize', 'token_url' => 'https://api.hubapi.com/oauth/v1/token', 'scope' => 'crm.objects.contacts.read crm.objects.deals.read'),
            'hubspot_write'    => array('name' => 'HubSpot', 'type' => 'oauth', 'auth_url' => 'https://app.hubspot.com/oauth/authorize', 'token_url' => 'https://api.hubapi.com/oauth/v1/token', 'scope' => 'crm.objects.contacts.write crm.objects.deals.write'),
            'intercom'         => array('name' => 'Intercom', 'type' => 'oauth', 'auth_url' => 'https://app.intercom.com/oauth', 'token_url' => 'https://api.intercom.io/auth/eagle/token', 'scope' => ''),
            'jira'             => array('name' => 'Atlassian', 'type' => 'oauth', 'auth_url' => 'https://auth.atlassian.com/authorize', 'token_url' => 'https://auth.atlassian.com/oauth/token', 'scope' => 'read:me read:jira-work offline_access', 'audience' => 'api.atlassian.com'),
            'linear'           => array('name' => 'Linear', 'type' => 'oauth', 'auth_url' => 'https://linear.app/oauth/authorize', 'token_url' => 'https://api.linear.app/oauth/token', 'scope' => 'read'),
            'notion'           => array('name' => 'Notion', 'type' => 'oauth', 'auth_url' => 'https://api.notion.com/v1/oauth/authorize', 'token_url' => 'https://api.notion.com/v1/oauth/token', 'scope' => ''),
            'salesforce'       => array('name' => 'Salesforce', 'type' => 'oauth', 'auth_url' => 'https://login.salesforce.com/services/oauth2/authorize', 'token_url' => 'https://login.salesforce.com/services/oauth2/token', 'scope' => 'api refresh_token'),
            'slack'            => array('name' => 'Slack', 'type' => 'oauth', 'auth_url' => 'https://slack.com/oauth/v2/authorize', 'token_url' => 'https://slack.com/api/oauth.v2.access', 'scope' => 'channels:history,channels:read,chat:write,users:read'),
            'gitlab'           => array('name' => 'GitLab', 'type' => 'oauth', 'auth_url' => 'https://gitlab.com/oauth/authorize', 'token_url' => 'https://gitlab.com/oauth/token', 'scope' => 'read_api'),
            'bitbucket'        => array('name' => 'Bitbucket', 'type' => 'oauth', 'auth_url' => 'https://bitbucket.org/site/oauth2/authorize', 'token_url' => 'https://bitbucket.org/site/oauth2/access_token', 'scope' => 'repository issue'),
            'basecamp'         => array('name' => 'Basecamp', 'type' => 'oauth', 'auth_url' => 'https://launchpad.37signals.com/authorization/new', 'token_url' => 'https://launchpad.37signals.com/authorization/token', 'scope' => ''),
            'clickup'          => array('name' => 'ClickUp', 'type' => 'oauth', 'auth_url' => 'https://app.clickup.com/api', 'token_url' => 'https://api.clickup.com/api/v2/oauth/token', 'scope' => ''),
            'front'            => array('name' => 'Front', 'type' => 'oauth', 'auth_url' => 'https://app.frontapp.com/oauth/authorize', 'token_url' => 'https://app.frontapp.com/oauth/token', 'scope' => ''),
            'gong'             => array('name' => 'Gong', 'type' => 'oauth', 'auth_url' => 'https://app.gong.io/oauth2/authorize', 'token_url' => 'https://app.gong.io/oauth2/generate-customer-token', 'scope' => 'api:calls:read:basic api:calls:read:transcript'),
            'monday'           => array('name' => 'Monday.com', 'type' => 'oauth', 'auth_url' => 'https://auth.monday.com/oauth2/authorize', 'token_url' => 'https://auth.monday.com/oauth2/token', 'scope' => 'boards:read updates:read'),
            'pipedrive'        => array('name' => 'Pipedrive', 'type' => 'oauth', 'auth_url' => 'https://oauth.pipedrive.com/oauth/authorize', 'token_url' => 'https://oauth.pipedrive.com/oauth/token', 'scope' => ''),
            'zendesk'          => array('name' => 'Zendesk', 'type' => 'oauth', 'auth_url' => '', 'token_url' => '', 'scope' => 'read'),
            'ashby'            => array('name' => 'Ashby', 'type' => 'oauth', 'auth_url' => '', 'token_url' => '', 'scope' => ''),
            'postgres'         => array('name' => 'PostgreSQL', 'type' => 'credentials'),
            'granola'          => array('name' => 'Granola', 'type' => 'credentials'),
            'snowflake'        => array('name' => 'Snowflake', 'type' => 'credentials'),
        );
    }
}

if (!function_exists('versace22_data_source_option')) {
    function versace22_data_source_option($provider, $suffix) {
        $key = strtoupper(preg_replace('/[^a-z0-9]+/i', '_', $provider));
        $constant = 'VERSACE22_' . $key . '_' . $suffix;
        if (defined($constant) && constant($constant) !== '') return constant($constant);
        $value = get_option(strtolower($constant), '');
        return is_string($value) ? trim($value) : '';
    }
}

if (!function_exists('versace22_data_source_redirect_uri')) {
    function versace22_data_source_redirect_uri() {
        return admin_url('admin-ajax.php?action=aicpp_user_data_source_oauth_callback');
    }
}

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
            auth_type varchar(32) NOT NULL DEFAULT 'oauth',
            credentials longtext NULL,
            access_token longtext NULL,
            refresh_token longtext NULL,
            token_expires_at datetime NULL,
            meta longtext NULL,
            status varchar(32) NOT NULL DEFAULT 'connected',
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY provider (provider)
        ) $charset;");

        $columns = $wpdb->get_col("SHOW COLUMNS FROM {$table}", 0);
        $missing = array(
            'auth_type'        => "ALTER TABLE {$table} ADD COLUMN auth_type varchar(32) NOT NULL DEFAULT 'oauth' AFTER label",
            'access_token'     => "ALTER TABLE {$table} ADD COLUMN access_token longtext NULL AFTER credentials",
            'refresh_token'    => "ALTER TABLE {$table} ADD COLUMN refresh_token longtext NULL AFTER access_token",
            'token_expires_at' => "ALTER TABLE {$table} ADD COLUMN token_expires_at datetime NULL AFTER refresh_token",
            'meta'             => "ALTER TABLE {$table} ADD COLUMN meta longtext NULL AFTER token_expires_at",
        );
        foreach ($missing as $column => $sql) {
            if (!in_array($column, $columns, true)) {
                $wpdb->query($sql);
            }
        }
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
        $auth_type = isset($_POST['auth_type']) ? sanitize_key(wp_unslash($_POST['auth_type'])) : 'credentials';
        if ($provider === '') wp_send_json_error(array('message' => 'Provider is required'));
        if ($creds === '') wp_send_json_error(array('message' => 'Authentication credentials are required'));

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        $ok = $wpdb->insert($table, array(
            'user_id' => $user_id,
            'provider' => $provider,
            'label' => $label !== '' ? $label : $provider,
            'auth_type' => $auth_type,
            'credentials' => $creds,
            'status' => 'connected',
            'created_at' => current_time('mysql'),
        ), array('%d', '%s', '%s', '%s', '%s', '%s', '%s'));
        if (!$ok) wp_send_json_error(array('message' => 'Failed to connect data source'));
        wp_send_json_success(array('id' => (int) $wpdb->insert_id));
    }
    add_action('wp_ajax_aicpp_user_connect_data_source', 'versace22_ajax_connect_data_source');
}

if (!function_exists('versace22_ajax_start_data_source_auth')) {
    function versace22_ajax_start_data_source_auth() {
        $user_id = versace22_projects_check_request();
        $provider = isset($_POST['provider']) ? sanitize_key(wp_unslash($_POST['provider'])) : '';
        $return_url = isset($_POST['return_url']) ? esc_url_raw(wp_unslash($_POST['return_url'])) : home_url('/');
        $providers = versace22_data_source_providers();
        if ($provider === '' || empty($providers[$provider])) wp_send_json_error(array('message' => 'Unsupported data source'));
        $cfg = $providers[$provider];
        if (($cfg['type'] ?? '') !== 'oauth') wp_send_json_error(array('message' => 'This source uses credential authentication'));
        if (empty($cfg['auth_url']) || empty($cfg['token_url'])) wp_send_json_error(array('message' => $cfg['name'] . ' OAuth endpoint is not configured yet.'));

        $client_id = versace22_data_source_option($provider, 'CLIENT_ID');
        $client_secret = versace22_data_source_option($provider, 'CLIENT_SECRET');
        if ($client_id === '' || $client_secret === '') {
            wp_send_json_error(array('message' => $cfg['name'] . ' OAuth credentials are not configured on this WordPress site.'));
        }

        $state = wp_generate_password(32, false, false);
        set_transient('versace22_ds_oauth_' . $state, array(
            'user_id' => $user_id,
            'provider' => $provider,
            'return_url' => $return_url,
        ), 10 * MINUTE_IN_SECONDS);

        $args = array(
            'client_id' => $client_id,
            'redirect_uri' => versace22_data_source_redirect_uri(),
            'response_type' => 'code',
            'state' => $state,
        );
        if (!empty($cfg['scope'])) $args['scope'] = $cfg['scope'];
        if (!empty($cfg['audience'])) $args['audience'] = $cfg['audience'];
        if (in_array($provider, array('google_drive', 'google_calendar', 'bigquery'), true)) {
            $args['access_type'] = 'offline';
            $args['prompt'] = 'consent';
        }

        wp_send_json_success(array('auth_url' => add_query_arg($args, $cfg['auth_url'])));
    }
    add_action('wp_ajax_aicpp_user_start_data_source_auth', 'versace22_ajax_start_data_source_auth');
}

if (!function_exists('versace22_ajax_data_source_oauth_callback')) {
    function versace22_ajax_data_source_oauth_callback() {
        $code = isset($_GET['code']) ? sanitize_text_field(wp_unslash($_GET['code'])) : '';
        $state = isset($_GET['state']) ? sanitize_text_field(wp_unslash($_GET['state'])) : '';
        $error = isset($_GET['error']) ? sanitize_text_field(wp_unslash($_GET['error'])) : '';
        $payload = $state ? get_transient('versace22_ds_oauth_' . $state) : false;
        if (!$payload) wp_die('Authentication session expired. Please try again.');
        delete_transient('versace22_ds_oauth_' . $state);
        $return_url = !empty($payload['return_url']) ? esc_url_raw($payload['return_url']) : home_url('/');
        if ($error !== '') wp_safe_redirect(add_query_arg('versace22_data_source_error', rawurlencode($error), $return_url));
        if ($error !== '') exit;
        if ($code === '') wp_die('Missing authorization code.');

        $providers = versace22_data_source_providers();
        $provider = sanitize_key($payload['provider']);
        if (empty($providers[$provider])) wp_die('Unsupported data source.');
        $cfg = $providers[$provider];
        $client_id = versace22_data_source_option($provider, 'CLIENT_ID');
        $client_secret = versace22_data_source_option($provider, 'CLIENT_SECRET');

        $body = array(
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => versace22_data_source_redirect_uri(),
            'client_id' => $client_id,
            'client_secret' => $client_secret,
        );
        $headers = array('Accept' => 'application/json');
        if ($provider === 'notion') {
            $headers['Authorization'] = 'Basic ' . base64_encode($client_id . ':' . $client_secret);
            unset($body['client_id'], $body['client_secret']);
        }

        $response = wp_remote_post($cfg['token_url'], array('timeout' => 20, 'headers' => $headers, 'body' => $body));
        if (is_wp_error($response)) wp_die(esc_html($response->get_error_message()));
        $status = (int) wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300 || empty($data['access_token'])) {
            wp_die('Authentication failed: ' . esc_html(wp_remote_retrieve_body($response)));
        }

        global $wpdb;
        $table = $wpdb->prefix . 'aicpp_user_data_sources';
        $expires_at = !empty($data['expires_in']) ? gmdate('Y-m-d H:i:s', time() + (int) $data['expires_in']) : null;
        $wpdb->insert($table, array(
            'user_id' => (int) $payload['user_id'],
            'provider' => $provider,
            'label' => $cfg['name'],
            'auth_type' => 'oauth',
            'access_token' => $data['access_token'],
            'refresh_token' => isset($data['refresh_token']) ? $data['refresh_token'] : null,
            'token_expires_at' => $expires_at,
            'meta' => wp_json_encode($data),
            'status' => 'connected',
            'created_at' => current_time('mysql'),
        ), array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s'));

        wp_safe_redirect(add_query_arg('versace22_data_source_connected', rawurlencode($provider), $return_url));
        exit;
    }
    add_action('wp_ajax_aicpp_user_data_source_oauth_callback', 'versace22_ajax_data_source_oauth_callback');
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
