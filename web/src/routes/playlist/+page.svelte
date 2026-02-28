<script>
    import { t } from "$lib/i18n/translations";

    import Omnibox from "$components/playlist/Omnibox.svelte";
    import Meowbalt from "$components/misc/Meowbalt.svelte";
    import SupportedServices from "$components/playlist/SupportedServices.svelte";
    import { createDialog } from "$lib/state/dialogs";
</script>

<svelte:head>
    <title>{$t("general.cobalt")}</title>
    <meta property="og:title" content={$t("general.cobalt")} />
</svelte:head>

{createDialog({
    id: "beta-dialog",
    meowbalt: "question",
    title: "beta feature",
    bodyText: $t("playlist.label.warning"),
    dismissable: true,
    leftAligned: true,
    type: "small"
})}
<div id="cobalt-playlist-container" class="center-column-container">
    <SupportedServices />
    <main
        id="cobalt-playlist"
        tabindex="-1"
        data-first-focus
    >
        <Meowbalt emotion="smile" />
        <Omnibox />
    </main>

    <div id="source-note">
        {$t("playlist.source.playlist.downloader")}
        <a href="https://github.com/hyperdefined/playlist.cobalt.directory">{$t("playlist.source.playlist.downloader.link")}</a>
    </div>
    <div id="terms-note">
        {$t("playlist.terms.note.agreement")}
        <a href="/about/terms">{$t("playlist.terms.note.link")}</a>
    </div>
</div>

<style>
    #cobalt-playlist-container {
        padding: var(--padding);
        overflow: hidden;
    }

    #cobalt-playlist {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        gap: 15px;
    }

    #terms-note {
        bottom: 0;
        color: var(--gray);
        font-size: 12px;
        text-align: center;
        padding-bottom: 6px;
        font-weight: 500;
    }

    #source-note {
        bottom: 0;
        color: var(--gray);
        font-size: 12px;
        text-align: center;
        padding-bottom: 6px;
        font-weight: 500;
    }

    @media screen and (max-width: 535px) {
        #cobalt-playlist-container {
            padding-top: calc(var(--padding) / 2);
        }

        #terms-note {
            font-size: 11px;
            padding-bottom: 0;
        }

        #source-note {
            font-size: 11px;
            padding-bottom: 0;
        }
    }
</style>
