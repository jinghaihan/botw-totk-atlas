<script setup lang="ts">
useHead({ title: 'Wilds Atlas' })
</script>

<template>
  <main flex-col-center gap-4 size-full>
    <h1 text-3xl font-semibold>
      Wilds Atlas
    </h1>
    <p text-lg>
      旷野图志
    </p>
    <div flex gap-2>
      <DarkToggle />
      <LanguageToggle />
    </div>
  </main>
</template>
