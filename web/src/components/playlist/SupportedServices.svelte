<script lang="ts">
    import { t } from "$lib/i18n/translations";
    import cachedInfo from "$lib/state/server-info";
    import { getServerInfo } from "$lib/api/server-info";
    import { getServiceStatus, getAllServiceTests, type AggregatedServiceStatus } from "$lib/api/service-status";
    import cachedServiceStatus from "$lib/state/service-status";

    import Skeleton from "$components/misc/Skeleton.svelte";
    import IconPlus from "@tabler/icons-svelte/IconPlus.svelte";
    import IconCheck from "@tabler/icons-svelte/IconCheck.svelte";
    import IconX from "@tabler/icons-svelte/IconX.svelte";
    import IconLoader2 from "@tabler/icons-svelte/IconLoader2.svelte";
    import IconQuestionMark from "@tabler/icons-svelte/IconQuestionMark.svelte";
    import PopoverContainer from "$components/misc/PopoverContainer.svelte";

    let services: string[] = [];
    let serviceStatuses: Record<string, AggregatedServiceStatus> = {};

    $: expanded = false;

    let servicesContainer: HTMLDivElement;
    $: loaded = false;
    $: statusLoading = false;
    $: statusLoaded = false;

    const loadInfo = async () => {
        await getServerInfo();

        if ($cachedInfo) {
            loaded = true;
            services = ($cachedInfo.info.cobalt as { playlistServices?: string[] }).playlistServices ?? [];
        }
    };

    const loadServiceStatus = async () => {
        if (statusLoaded || statusLoading) return;
        
        statusLoading = true;
        await getServiceStatus();
        serviceStatuses = getAllServiceTests();
        statusLoading = false;
        statusLoaded = true;
    };

    $: if ($cachedServiceStatus) {
        serviceStatuses = getAllServiceTests();
        statusLoaded = true;
        statusLoading = false;
    }

    const getStatusForService = (service: string): AggregatedServiceStatus | undefined => {
        const key = service.toLowerCase();
        return serviceStatuses[key];
    };

    const popoverAction = async () => {
        expanded = !expanded;
        if (expanded && services.length === 0) {
            await loadInfo();
        }
        if (expanded) {
            servicesContainer.focus();
            loadServiceStatus();
        }
    };
</script>

<div id="supported-services" class:expanded>
    <button
        id="services-button"
        class="button"
        on:click={popoverAction}
        aria-label={$t(`playlist.services.title_${expanded ? "hide" : "show"}`)}
    >
        <div class="expand-icon">
            <IconPlus />
        </div>
        <span class="title">{$t("playlist.services.title")}</span>
    </button>

    <PopoverContainer id="services-popover" {expanded}>
        <div
            id="services-container"
            bind:this={servicesContainer}
            tabindex="-1"
        >
            {#if loaded}
                {#each services as service}
                    {@const status = getStatusForService(service)}
                    <div 
                        class="service-item" 
                        class:service-working={status?.status === true} 
                        class:service-not-working={status?.status === false}
                        class:service-unknown={statusLoaded && status?.status === null}
                        title={status?.status === false ? status?.message : undefined}
                    >
                        <span class="service-name">{service}</span>
                        <span class="service-status-icon">
                            {#if statusLoading}
                                <IconLoader2 />
                            {:else if status?.status === true}
                                <IconCheck />
                            {:else if status?.status === false}
                                <IconX />
                            {:else if statusLoaded}
                                <IconQuestionMark />
                            {/if}
                        </span>
                    </div>
                {/each}
            {:else}
                {#each { length: 17 } as _}
                    <Skeleton
                        class="elevated"
                        width={Math.random() * 44 + 50 + "px"}
                        height="24.5px"
                    />
                {/each}
            {/if}
        </div>
        <div id="services-disclaimer" class="subtext">
            {$t("playlist.services.disclaimer")}
        </div>
    </PopoverContainer>
</div>

<style>
    #supported-services {
        display: flex;
        position: relative;
        max-width: 400px;
        flex-direction: column;
        align-items: center;
        height: 35px;
    }

    #services-button {
        gap: 9px;
        padding: 7px 13px 7px 10px;
        justify-content: flex-start;
        border-radius: 18px;
        display: flex;
        flex-direction: row;
        font-size: 13px;
        font-weight: 500;
        background: none;
        transition:
            background 0.2s,
            box-shadow 0.1s;
    }

    #services-button:not(:active) {
        box-shadow: none;
    }

    .expand-icon {
        height: 22px;
        width: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        background: var(--button-elevated);
        padding: 0;
        box-shadow: none;
        transition:
            background 0.2s,
            transform 0.2s;
    }

    #services-button:active {
        background: var(--button-hover-transparent);
    }

    @media (hover: hover) {
        #services-button:hover {
            background: var(--button-hover-transparent);
        }

        #services-button:active {
            background: var(--button-press-transparent);
        }

        #services-button:hover .expand-icon {
            background: var(--button-elevated-hover);
        }
    }

    @media (hover: none) {
        #services-button:active {
            box-shadow: none;
        }
    }

    #services-button:active .expand-icon {
        background: var(--button-elevated-press);
    }

    .expand-icon :global(svg) {
        height: 18px;
        width: 18px;
        stroke-width: 2px;
        color: var(--secondary);
        will-change: transform;
    }

    .expanded .expand-icon {
        transform: rotate(45deg);
    }

    #services-container {
        display: flex;
        flex-wrap: wrap;
        flex-direction: row;
        gap: 3px;
    }

    .service-item {
        display: flex;
        padding: 4px 8px;
        border-radius: calc(var(--border-radius) / 2);
        background: var(--button-elevated);
        font-size: 12.5px;
        font-weight: 500;
        align-items: center;
        gap: 4px;
    }

    .service-name {
        display: flex;
    }

    .service-status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
    }

    .service-status-icon :global(svg) {
        width: 14px;
        height: 14px;
        stroke-width: 2.5px;
    }

    .service-item.service-working .service-status-icon :global(svg) {
        color: var(--green);
    }

    .service-item.service-not-working .service-status-icon :global(svg) {
        color: var(--red);
    }

    .service-item.service-unknown .service-status-icon :global(svg) {
        color: var(--gray);
    }

    .service-item.service-not-working {
        cursor: help;
    }

    .service-status-icon :global(svg.tabler-icon-loader-2) {
        color: var(--gray);
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    #services-disclaimer {
        padding: 0;
        user-select: none;
        -webkit-user-select: none;
    }

    .expanded #services-disclaimer {
        padding: 0;
        user-select: text;
        -webkit-user-select: text;
    }

    @media screen and (max-width: 535px) {
        .expand-icon {
            height: 21px;
            width: 21px;
        }

        .expand-icon :global(svg) {
            height: 16px;
            width: 16px;
        }
    }
</style>
