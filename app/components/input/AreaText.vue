<script lang="ts" setup>
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { ArrowUpIcon } from 'lucide-vue-next'

const urls = ref('')
const emits = defineEmits<{
    (e: 'uploadUrls', urls: string[]): void;
}>()

const uploadUrl = () => {
    // 上传逻辑待实现
    emits('uploadUrls', urls.value.split('\n').map(url => url.trim()).filter(url => url !== ''))
}
</script>

<template>
    <InputGroup>
        <InputGroupTextarea v-model="urls" placeholder="每行一个文件地址" class="min-h-40dvh" />
        <InputGroupAddon align="block-end">
            <InputGroupButton variant="default" class="rounded-full ml-auto cursor-pointer" size="icon-xs"
                @click="uploadUrl">
                <ArrowUpIcon class="size-4 " />
            </InputGroupButton>
        </InputGroupAddon>
    </InputGroup>
</template>