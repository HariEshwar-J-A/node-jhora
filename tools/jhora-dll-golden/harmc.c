#include <windows.h>
#include <stdio.h>
typedef int (__stdcall *f_ha)(double,double,double,int,double*,double*);
int main(){ HMODULE h=LoadLibraryA("swedll32.dll"); f_ha ha=(f_ha)GetProcAddress(h,"_swe_houses_armc@36"); if(!ha){printf("noproc\n");return 1;}
 double armc,lat,eps; while(scanf("%lf %lf %lf",&armc,&lat,&eps)==3){ double c[13],a[10]; int r=ha(armc,lat,eps,'P',c,a); printf("%d",r); for(int j=1;j<=12;j++) printf(" %.12f",c[j]); printf("\n"); fflush(stdout);} return 0;}
