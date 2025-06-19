import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./web/welcome/welcome').then(c => c.Welcome),
    },
    {
        path: 'project',
        loadComponent: () =>
            import('./web/layout/layout').then(c => c.Layout),
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('./web/editor/editor').then(c => c.Editor),
            },
        ]
    }
];
